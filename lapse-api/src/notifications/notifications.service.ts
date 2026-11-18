import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { DATABASE } from '../database/database.js';
import type { UserItemRow } from '../expiration/models.js';
import { deliveryPlan, type DeliveryPreferences } from './notification-plan.js';
import type { DeviceDto, ItemNotificationDto } from './notifications.dto.js';
type Device = { id: string; user_id: string; token: string; enabled: boolean };
type Ticket = { status: string; id?: string; details?: { error?: string } };
@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE) private readonly db: Knex) {}
  configured() {
    return process.env.REMOTE_PUSH_ENABLED === 'true';
  }
  async preferences(userId: string) {
    const saved = await this.db('notification_preferences')
      .where('user_id', userId)
      .first();
    return {
      configured: this.configured(),
      initialized: !!saved,
      ...(saved ?? {
        enabled: true,
        offsets: [7, 1, 0],
        hour: 9,
        timezone: 'UTC',
      }),
    };
  }
  async savePreferences(userId: string, value: DeliveryPreferences) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format();
    } catch {
      throw new BadRequestException('Choose a valid timezone');
    }
    await this.db('notification_preferences')
      .insert({
        user_id: userId,
        enabled: value.enabled,
        offsets: JSON.stringify(value.offsets),
        hour: value.hour,
        timezone: value.timezone,
        next_check_at: this.db.fn.now(),
        item_cursor: null,
      })
      .onConflict('user_id')
      .merge();
    return this.preferences(userId);
  }
  async device(userId: string, value: DeviceDto) {
    // Unique installation and token: transfer atomically on account switching.
    await this.db.transaction(async (trx) => {
      await trx('notification_devices')
        .where('token', value.token)
        .whereNot('id', value.id)
        .delete();
      const existing = await trx('notification_devices')
        .where('id', value.id)
        .forUpdate()
        .first();
      if (
        existing &&
        existing.user_id !== userId &&
        existing.token !== value.token
      )
        throw new ConflictException(
          'Device registration changed. Sign in again on this installation',
        );
      const account = await trx('master_users')
        .where('id', userId)
        .forUpdate()
        .first();
      await trx('notification_devices')
        .insert({
          id: value.id,
          token: value.token,
          enabled: value.enabled,
          user_id: userId,
          token_version: account.token_version,
          updated_at: trx.fn.now(),
        })
        .onConflict('id')
        .merge();
    });
    return { registered: true, configured: this.configured() };
  }
  async removeDevice(userId: string, id: string) {
    await this.db('notification_devices')
      .where({ id, user_id: userId })
      .delete();
    return { deleted: true };
  }
  async itemPreferences(
    userId: string,
    itemId: string,
    value?: ItemNotificationDto,
  ) {
    if (
      !(await this.db('user_items')
        .where({ id: itemId, user_id: userId })
        .first())
    )
      throw new NotFoundException('Item not found');
    if (value) {
      if (value.mode === 'OVERRIDE' && !value.offsets.length)
        throw new BadRequestException('Select a reminder offset');
      await this.db('notification_item_preferences')
        .insert({
          user_id: userId,
          item_id: itemId,
          mode: value.mode,
          offsets: JSON.stringify(value.offsets),
        })
        .onConflict('item_id')
        .merge();
      await this.db('notification_preferences')
        .where('user_id', userId)
        .update({ next_check_at: this.db.fn.now(), item_cursor: null });
    }
    return (
      (await this.db('notification_item_preferences')
        .where({ user_id: userId, item_id: itemId })
        .first()) ?? { mode: 'INHERIT', offsets: [] }
    );
  }
  async inbox(userId: string) {
    const data = await this.db('notification_inbox')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(200);
    const unread = await this.db('notification_inbox')
      .where('user_id', userId)
      .whereNull('read_at')
      .count('* as count')
      .first();
    return { data, unread: Number(unread?.count ?? 0) };
  }
  async read(userId: string, id?: string) {
    const query = this.db('notification_inbox')
      .where('user_id', userId)
      .whereNull('read_at');
    if (id) query.where('id', id);
    await query.update({ read_at: this.db.fn.now() });
    return { read: true };
  }
  async dispatch() {
    if (!this.configured()) return { configured: false, processed: 0 };
    await this.receipts();
    let processed = 0;
    const deadline = Date.now() + 18000;
    while (processed < 25 && Date.now() < deadline) {
      const claimed = await this.db.transaction(async (trx) => {
        const pref = await trx('notification_preferences as p')
          .join('master_users as u', 'p.user_id', 'u.id')
          .where('p.enabled', true)
          .where('u.is_active', true)
          .where('p.next_check_at', '<=', trx.fn.now())
          .whereExists(
            trx('notification_devices as d')
              .select('d.id')
              .whereRaw(
                'd.user_id=p.user_id AND d.token_version=u.token_version',
              )
              .where('d.enabled', true),
          )
          .select('p.*')
          .orderBy('p.next_check_at')
          .forUpdate('p')
          .skipLocked()
          .first();
        if (!pref) return null;
        await trx('notification_preferences')
          .where('user_id', pref.user_id)
          .update({
            next_check_at: new Date(
              (Math.floor(Date.now() / 3600000) + 1) * 3600000,
            ),
          });
        return pref as DeliveryPreferences & { user_id: string };
      });
      if (!claimed) break;
      await this.deliver(claimed);
      processed++;
    }
    // Bounded retention; maintenance never touches user_items.
    await this.db('notification_inbox')
      .whereIn(
        'id',
        this.db('notification_inbox')
          .select('id')
          .where('created_at', '<', new Date(Date.now() - 90 * 86400000))
          .limit(200),
      )
      .delete();
    return { configured: true, processed };
  }
  private async deliver(pref: DeliveryPreferences & { user_id: string }) {
    return this.db.transaction(async (trx) => {
      // Serialize preference and schedule changes against dispatch. Deleted/edited
      // rows are read only after their owning transaction commits.
      const account = await trx('master_users')
        .where({ id: pref.user_id, is_active: true })
        .forUpdate()
        .first();
      if (!account) return;
      const current = await trx('notification_preferences')
        .where('user_id', pref.user_id)
        .forUpdate()
        .first();
      if (!current?.enabled) return;
      pref = current;
      await this.deliverLocked(trx, pref);
    });
  }
  private async deliverLocked(
    db: Knex,
    pref: DeliveryPreferences & {
      user_id: string;
      item_cursor?: string | null;
    },
  ) {
    const query = db('user_items')
      .where('user_id', pref.user_id)
      .whereNot('expiry_type', 'NEVER')
      .orderBy('id')
      .limit(20)
      .forUpdate();
    if (pref.item_cursor) query.where('id', '>', pref.item_cursor);
    const items: UserItemRow[] = await query;
    const overrides: { item_id: string; mode: string; offsets: number[] }[] =
      await db('notification_item_preferences').where('user_id', pref.user_id);
    const devices: Device[] = await db('notification_devices as d')
      .join('master_users as u', 'd.user_id', 'u.id')
      .where({
        'd.user_id': pref.user_id,
        'd.enabled': true,
        'u.is_active': true,
      })
      .whereRaw('d.token_version=u.token_version')
      .select('d.*')
      .limit(10);
    const batch: {
      reminder_id: string;
      device_id: string;
      token: string;
      title: string;
      body: string;
      itemId: string;
    }[] = [];
    let cursor = pref.item_cursor ?? null,
      stopped = false;
    for (const item of items) {
      const override = overrides.find((row) => row.item_id === item.id);
      const plan = deliveryPlan([item], {
        ...pref,
        enabled: override?.mode !== 'DISABLED',
        offsets:
          override?.mode === 'OVERRIDE' ? override.offsets : pref.offsets,
      });
      if (batch.length && batch.length + plan.length * devices.length > 100) {
        stopped = true;
        break;
      }
      for (const row of plan) {
        const id = `${pref.user_id}:${row.itemId}:${row.occurrence}:${row.offset}`;
        const title = `${row.name} ${row.offset === 0 ? 'is due today' : 'is coming up'}`;
        const body = `Due ${row.occurrence}`;
        await db('notification_inbox')
          .insert({
            id,
            user_id: pref.user_id,
            item_id: row.itemId,
            title,
            body,
          })
          .onConflict('id')
          .ignore();
        for (const device of devices) {
          if (batch.length >= 100) break;
          const claim = await db('notification_attempts')
            .insert({ reminder_id: id, device_id: device.id })
            .onConflict(['reminder_id', 'device_id'])
            .merge({
              state: 'claimed',
              attempt_count: db.raw('notification_attempts.attempt_count + 1'),
              updated_at: db.fn.now(),
            })
            .whereRaw(
              "notification_attempts.state='retry' AND notification_attempts.attempt_count < 3",
            )
            .returning('device_id');
          if (!claim.length) continue;
          batch.push({
            reminder_id: id,
            device_id: device.id,
            token: device.token,
            title,
            body,
            itemId: row.itemId,
          });
        }
      }
      cursor = item.id;
    }
    const more = stopped || items.length === 20;
    await db('notification_preferences')
      .where('user_id', pref.user_id)
      .update({
        item_cursor: more ? cursor : null,
        next_check_at: more
          ? new Date()
          : new Date((Math.floor(Date.now() / 3600000) + 1) * 3600000),
      });
    if (!batch.length) return;
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: this.pushHeaders(),
        body: JSON.stringify(
          batch.map((row) => ({
            to: row.token,
            title: row.title,
            body: row.body,
            sound: 'default',
            channelId: 'renewals',
            data: {
              lapse: true,
              reminderId: row.reminder_id,
              itemId: row.itemId,
            },
          })),
        ),
      });
      const result = (await response.json()) as { data?: Ticket[] };
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i],
          ticket = result.data?.[i];
        await db('notification_attempts')
          .where({ reminder_id: row.reminder_id, device_id: row.device_id })
          .update({
            state:
              response.status === 429
                ? 'retry'
                : ticket?.status === 'ok'
                  ? 'accepted'
                  : ticket?.details?.error === 'MessageRateExceeded'
                    ? 'retry'
                    : ticket?.status === 'error'
                      ? 'failed'
                      : 'unknown',
            ticket: ticket?.id ?? null,
            updated_at: db.fn.now(),
          });
        if (ticket?.details?.error === 'DeviceNotRegistered')
          await db('notification_devices')
            .where('id', row.device_id)
            .update({ enabled: false });
      }
    } catch {
      // Ambiguous requests may have been accepted: do not blindly resubmit.
      for (const row of batch)
        await db('notification_attempts')
          .where({ reminder_id: row.reminder_id, device_id: row.device_id })
          .update({ state: 'unknown', updated_at: db.fn.now() });
    }
  }
  private pushHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    };
  }

  private async receipts() {
    await this.db('notification_attempts')
      .whereIn(
        'reminder_id',
        this.db('notification_attempts')
          .select('reminder_id')
          .where('state', 'accepted')
          .where('updated_at', '<', new Date(Date.now() - 24 * 3600000))
          .limit(100),
      )
      .where('state', 'accepted')
      .update({ state: 'receipt_unknown' });
    const pending: {
      reminder_id: string;
      device_id: string;
      ticket: string;
    }[] = await this.db('notification_attempts')
      .where('state', 'accepted')
      .where('updated_at', '<', new Date(Date.now() - 15 * 60000))
      .limit(100);
    if (!pending.length) return;
    try {
      const response = await fetch(
        'https://exp.host/--/api/v2/push/getReceipts',
        {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ ids: pending.map((row) => row.ticket) }),
        },
      );
      const result = (await response.json()) as {
        data?: Record<string, Ticket>;
      };
      for (const attempt of pending) {
        const receipt = result.data?.[attempt.ticket];
        if (!receipt) continue;
        await this.db('notification_attempts')
          .where({
            reminder_id: attempt.reminder_id,
            device_id: attempt.device_id,
          })
          .update({
            state: receipt.status === 'ok' ? 'receipt_ok' : 'failed',
            updated_at: this.db.fn.now(),
          });
        if (receipt.details?.error === 'DeviceNotRegistered')
          await this.db('notification_devices')
            .where('id', attempt.device_id)
            .update({ enabled: false });
      }
    } catch {
      /* Receipt polling retries on the next hourly run. */
    }
  }
}
