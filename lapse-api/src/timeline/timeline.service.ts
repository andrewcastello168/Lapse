import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

import { DATABASE } from '../database/database.js';

dayjs.extend(customParseFormat);

type ExpiryType = 'ONCE' | 'NEVER' | 'RECURRING';

type UserItem = {
  id: string | number;
  mi_id: string | number | null;
  mc_id: string | number;
  item_name: string;
  expiry_type: ExpiryType;
  expiry_date: string | Date | null;
  recurrence_years: number | null;
  recurrence_months: number | null;
  recurrence_days: number | null;
};

@Injectable()
export class TimelineService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Knex,
  ) {}

  async getTimeline(userId: string, from: string, to: string) {
    const start = dayjs(from, 'YYYY-MM-DD', true);
    const end = dayjs(to, 'YYYY-MM-DD', true);

    if (!start.isValid() || !end.isValid()) {
      throw new BadRequestException('Format from dan to harus YYYY-MM-DD');
    }

    if (start.isAfter(end)) {
      throw new BadRequestException(
        'Tanggal from tidak boleh melewati tanggal to',
      );
    }

    const items = (await this.db('user_items')
      .select(
        'id',
        'mi_id',
        'mc_id',
        'item_name',
        'expiry_type',
        'expiry_date',
        'recurrence_years',
        'recurrence_months',
        'recurrence_days',
      )
      .where('user_id', userId)) as UserItem[];

    const occurrences: {
      userItemId: string | number;
      masterItemId: string | number | null;
      categoryId: string | number;
      itemName: string;
      expiryType: ExpiryType;
      occurrenceDate: string;
    }[] = [];

    for (const item of items) {
      // NEVER tidak pernah muncul di Upcoming.
      if (item.expiry_type === 'NEVER') {
        continue;
      }

      // Item ONCE maupun RECURRING membutuhkan tanggal awal.
      if (!item.expiry_date) {
        continue;
      }

      const initialDate = dayjs(item.expiry_date);

      if (!initialDate.isValid()) {
        continue;
      }

      const addOccurrence = (date: dayjs.Dayjs) => {
        occurrences.push({
          userItemId: item.id,
          masterItemId: item.mi_id,
          categoryId: item.mc_id,
          itemName: item.item_name,
          expiryType: item.expiry_type,
          occurrenceDate: date.format('YYYY-MM-DD'),
        });
      };

      if (item.expiry_type === 'ONCE') {
        const inRange =
          !initialDate.isBefore(start, 'day') &&
          !initialDate.isAfter(end, 'day');

        if (inRange) {
          addOccurrence(initialDate);
        }

        continue;
      }

      if (item.expiry_type !== 'RECURRING') {
        continue;
      }

      const years = Number(item.recurrence_years ?? 0);
      const months = Number(item.recurrence_months ?? 0);
      const days = Number(item.recurrence_days ?? 0);

      // Hindari recurrence dengan interval kosong/tidak valid.
      if (
        years < 0 ||
        months < 0 ||
        days < 0 ||
        (years === 0 && months === 0 && days === 0)
      ) {
        continue;
      }

      // Gunakan tanggal awal sebagai anchor agar recurrence
      // bulanan tidak terus bergeser akibat penambahan berulang.
      for (let n = 0; ; n++) {
        const occurrence = initialDate
          .add(n * years, 'year')
          .add(n * months, 'month')
          .add(n * days, 'day');

        if (occurrence.isAfter(end, 'day')) {
          break;
        }

        if (!occurrence.isBefore(start, 'day')) {
          addOccurrence(occurrence);
        }
      }
    }

    occurrences.sort((a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate),
    );

    return {
      from,
      to,
      total: occurrences.length,
      data: occurrences,
    };
  }
}
