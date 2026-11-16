import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { DATABASE } from '../database/database.js';
import {
  addDays,
  derived,
  firstIndex,
  intervalOf,
  occurrence,
  parseDate,
  todayInZone,
  zonedInstant,
} from '../expiration/calendar.js';
import type { UserItemRow } from '../expiration/models.js';
import { withImages } from '../catalog-images.js';
import { QueryTimelineDto } from './query-timeline.dto.js';

export function eventsFor(
  items: UserItemRow[],
  from: string,
  to: string,
  zone: string,
) {
  const events: {
    userItemId: string;
    masterItemId: string | number | null;
    categoryId: number;
    itemName: string;
    expiryType: string;
    occurrenceDate: string;
    projected: boolean;
    image_path?: string | null;
    category_image_path?: string | null;
    renewalMode?: string | null;
  }[] = [];
  for (const item of items) {
    if (item.expiry_type === 'NEVER' || !item.expiry_date) continue;
    const add = (date: string) =>
      events.push({
        userItemId: item.id,
        masterItemId: item.mi_id,
        categoryId: item.mc_id,
        itemName: item.item_name,
        expiryType: item.expiry_type,
        occurrenceDate: date,
        projected: false,
        image_path: item.image_path,
        category_image_path: item.category_image_path,
        renewalMode: item.renewal_mode,
      });
    if (item.expiry_type === 'ONCE' || item.renewal_mode === 'MANUAL') {
      const date = derived(item, zone).effective_expiry_date;
      if (date && date >= from && date <= to) add(date);
      continue;
    }
    const interval = intervalOf(item);
    for (let n = firstIndex(item.expiry_date, interval, from); ; n++) {
      let date: string;
      try {
        date = occurrence(item.expiry_date, interval, n);
      } catch {
        break;
      }
      if (date > to) break;
      add(date);
      if (events.length > 100000)
        throw new BadRequestException('Choose a shorter timeline range');
    }
  }
  return events.sort(
    (a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate) ||
      a.userItemId.localeCompare(b.userItemId),
  );
}
@Injectable()
export class TimelineService {
  constructor(@Inject(DATABASE) private readonly db: Knex) {}
  private items(userId: string) {
    return this.db<UserItemRow>('user_items as ui')
      .leftJoin('master_categories as mc', 'ui.mc_id', 'mc.id')
      .leftJoin('master_items as mi', 'ui.mi_id', 'mi.id')
      .select(
        'ui.*',
        'mc.image_path as category_image_path',
        this.db.raw(
          "COALESCE(NULLIF(mi.image_path,''),mc.image_path) as image_path",
        ),
      )
      .where('ui.user_id', userId);
  }
  range(query: QueryTimelineDto, zone: string) {
    if ((query.from && !query.to) || (!query.from && query.to))
      throw new BadRequestException('Provide both from and to');
    const from = query.from ?? todayInZone(zone);
    const window = query.window ?? '3M';
    const to =
      query.to ??
      (window.endsWith('D')
        ? addDays(from, Number.parseInt(window))
        : occurrence(
            from,
            { years: 0, months: Number.parseInt(window), days: 0 },
            1,
          ));
    parseDate(from);
    parseDate(to);
    if (from > to || to > occurrence(from, { years: 1, months: 0, days: 0 }, 1))
      throw new BadRequestException(
        'Timeline range must be ordered and no longer than one calendar year',
      );
    return { from, to };
  }
  async getTimeline(userId: string, query: QueryTimelineDto, zone = 'UTC') {
    const { from, to } = this.range(query, zone);
    const events = eventsFor(await this.items(userId), from, to, zone);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 500;
    return {
      from,
      to,
      total: events.length,
      itemCount: new Set(events.map((e) => e.userItemId)).size,
      offset,
      limit,
      hasMore: offset + limit < events.length,
      data: await Promise.all(
        events.slice(offset, offset + limit).map(withImages),
      ),
    };
  }
  async reminders(userId: string, offset: number, hour: number, zone: string) {
    const from = todayInZone(zone);
    const to = occurrence(from, { years: 1, months: 0, days: 0 }, 1);
    const events = eventsFor(await this.items(userId), from, to, zone);
    const now = Date.now();
    return {
      timezone: zone,
      generatedAt: new Date().toISOString(),
      horizon: to,
      data: events
        .map((event) => ({
          id: `${userId}:${event.userItemId}:${event.occurrenceDate}:${offset}`,
          itemId: event.userItemId,
          itemName: event.itemName,
          occurrenceDate: event.occurrenceDate,
          offset,
          scheduledAt: zonedInstant(
            addDays(event.occurrenceDate, -offset),
            hour,
            zone,
          ),
        }))
        .filter((reminder) => Date.parse(reminder.scheduledAt) > now)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, 60),
    };
  }
}
