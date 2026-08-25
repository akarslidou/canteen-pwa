import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  API_BASE_URL,
  Meal,
  STUWE_ICON_BASE,
  STUWE_ICON_MAP,
} from '../models/canteen.model';

export interface DaySchedule {
  date: string;
  closed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CanteenService {
  constructor(private http: HttpClient) {}

  getTwoWeeksDays(): DaySchedule[] {
    const days: DaySchedule[] = [];
    const current = new Date();
    let count = 0;

    while (count < 10) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        days.push({ date: `${yyyy}-${mm}-${dd}`, closed: false });
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  async fetchAvailableDays(canteenId: number): Promise<DaySchedule[]> {
    const availableDays = this.getTwoWeeksDays();

    try {
      const daysData = await firstValueFrom(
        this.http.get<DaySchedule[]>(`${API_BASE_URL}${canteenId}/days`)
      );

      availableDays.forEach((day) => {
        const apiDay = daysData.find((d) => d.date === day.date);
        if (apiDay) {
          day.closed = apiDay.closed === true;
        }
      });
    } catch {
    }

    return availableDays;
  }

  async fetchMealsForDate(canteenId: number, date: string): Promise<Meal[]> {
    try {
      const meals = await firstValueFrom(
        this.http.get<Meal[]>(`${API_BASE_URL}${canteenId}/days/${date}/meals`)
      );
      return meals || [];
    } catch {
      return [];
    }
  }

  prefetchUpcomingDays(canteenId: number, days: DaySchedule[], selectedDate: string): void {
    days
      .filter((day) => day.date !== selectedDate)
      .forEach((day) => {
        this.http.get(`${API_BASE_URL}${canteenId}/days/${day.date}/meals`).subscribe({
          error: () => {}, 
        });
      });
  }

  getStuweIconPath(meal: Meal): string | null {
    const combined = [meal.name, meal.category, ...(meal.notes || [])]
      .join(' ')
      .toLowerCase();

    for (const [key, filename] of Object.entries(STUWE_ICON_MAP)) {
      if (combined.includes(key)) {
        return `${STUWE_ICON_BASE}${filename}`;
      }
    }
    return null;
  }
}