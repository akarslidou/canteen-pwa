import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HardwareService } from './services/hardware.service';
import { CanteenService, DaySchedule } from './services/canteen.service';
import {
  Canteen,
  Meal,
  UNIVERSITY_CANTEENS,
} from './models/canteen.model';

declare const L: any; // Leaflet Global Map Library

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  // Navigation & Auswahl
  universityCanteens = UNIVERSITY_CANTEENS;
  currentUniKey: string = 'tuebingen';
  selectedCanteen!: Canteen;

  // Modals & UI States
  sidebarOpen = false;
  inlineDropdownOpen = false;
  categoryDropdownOpen = false;
  
  // Status-Flags für Speiseplan
  isLoading = false;
  isClosed = false;
  isOfflineError = false;
  hasNoData = false;

  // Datum & Gerichte
  availableDays: DaySchedule[] = [];
  selectedDate: string = '';
  meals: Meal[] = [];
  
  // Filter & Preise
  activePriceType: 'students' | 'employees' | 'others' = 'students';
  activeFilterKeywords: string[] = [];
  expandedNotes: Record<string, boolean> = {};

  // Scroll Container für Tages-Karussell
  @ViewChild('dayCarousel') dayCarousel!: ElementRef<HTMLDivElement>;

  private map: any = null;

  constructor(
    public hardwareService: HardwareService,
    private canteenService: CanteenService
  ) {}

  ngOnInit(): void {
    // Initialisierung
    this.selectUniversity('tuebingen', false);

    // Online/Offline-Event-Listener
    window.addEventListener('offline', () => {
      this.isOfflineError = true;
    });

    window.addEventListener('online', () => {
      this.isOfflineError = false;
      this.loadMealsForDate(this.selectedDate);
    });
  }

  // === UNIS & MENSEN AUSWAHL ===
  selectUniversity(uniKey: string, closeMenu = true): void {
    this.currentUniKey = uniKey;
    const canteens = this.universityCanteens[uniKey];
    if (canteens && canteens.length > 0) {
      this.selectCanteen(canteens[0]);
    }
    if (closeMenu) {
      this.sidebarOpen = false;
    }
  }

  selectCanteen(canteen: Canteen): void {
    this.selectedCanteen = canteen;
    this.inlineDropdownOpen = false;
    this.resetMealsAndReload();
    this.initMap(canteen.lat, canteen.lng, canteen.name);
  }

  get inlineDropdownCanteens(): Canteen[] {
    const list = this.universityCanteens[this.currentUniKey] || [];
    return list.filter((c) => c.id !== this.selectedCanteen?.id);
  }

  // === MENSAPLAN & DATEN LADEN ===
  async resetMealsAndReload(): Promise<void> {
    this.meals = [];
    this.isClosed = false;
    this.isOfflineError = false;
    this.hasNoData = false;

    if (!this.selectedCanteen) return;

    this.availableDays = await this.canteenService.fetchAvailableDays(
      this.selectedCanteen.id
    );

    if (
      !this.selectedDate ||
      !this.availableDays.some((d) => d.date === this.selectedDate)
    ) {
      this.selectedDate = this.availableDays[0]?.date || '';
    }

    await this.loadMealsForDate(this.selectedDate);
    this.canteenService.prefetchUpcomingDays(
      this.selectedCanteen.id,
      this.availableDays,
      this.selectedDate
    );
  }

  async selectDate(date: string): Promise<void> {
    if (this.selectedDate === date) return;
    this.selectedDate = date;
    await this.loadMealsForDate(date);
  }

  async loadMealsForDate(date: string): Promise<void> {
    if (!date || !this.selectedCanteen) return;

    this.isLoading = true;
    this.isClosed = false;
    this.isOfflineError = false;
    this.hasNoData = false;

    try {
      this.meals = await this.canteenService.fetchMealsForDate(
        this.selectedCanteen.id,
        date
      );

      if (!navigator.onLine) {
        this.isOfflineError = true;
      }

      if (!this.meals || this.meals.length === 0) {
        const dayMeta = this.availableDays.find((d) => d.date === date);
        if (dayMeta && dayMeta.closed) {
          this.isClosed = true;
        } else {
          this.hasNoData = true;
        }
      }
    } catch {
      this.meals = [];
      if (!navigator.onLine) {
        this.isOfflineError = true;
      } else {
        this.hasNoData = true;
      }
    } finally {
      this.isLoading = false;
    }
  }

  // === FILTER & PRÜFUNG ===
  get filteredMeals(): Meal[] {
    if (this.activeFilterKeywords.length === 0) {
      return this.meals;
    }

    return this.meals.filter((meal) => {
      const mealText = [meal.name, meal.category, ...(meal.notes || [])]
        .join(' ')
        .toLowerCase();
      return this.activeFilterKeywords.some((keyword) =>
        mealText.includes(keyword)
      );
    });
  }

  toggleFilterKeyword(keyword: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.activeFilterKeywords.push(keyword.toLowerCase());
    } else {
      this.activeFilterKeywords = this.activeFilterKeywords.filter(
        (k) => k !== keyword.toLowerCase()
      );
    }
  }

  isKeywordActive(keyword: string): boolean {
    return this.activeFilterKeywords.includes(keyword.toLowerCase());
  }

  resetFilters(): void {
    this.activeFilterKeywords = [];
    this.categoryDropdownOpen = false;
  }

  // === PREIS-BERECHNUNG & DETAILS ===
  getMealPrice(meal: Meal): string {
    let priceVal: number | null = null;

    if (this.activePriceType === 'students') {
      priceVal = meal.prices?.students;
    } else {
      priceVal = meal.prices?.employees || meal.prices?.others || meal.prices?.pupils;
    }

    return priceVal ? `${priceVal.toFixed(2).replace('.', ',')} €` : 'N/A';
  }

  getCleanNotes(meal: Meal): string[] {
    return (meal.notes || []).filter((note) => {
      const n = note.toLowerCase();
      return !n.includes('[vegan]') && !n.includes('[v]') && !n.includes('vegetarisch');
    });
  }

  toggleMealNote(mealId: number): void {
    this.expandedNotes[mealId] = !this.expandedNotes[mealId];
  }

  getIconPath(meal: Meal): string | null {
    return this.canteenService.getStuweIconPath(meal);
  }

  // === KARUSSELL & UI NAVIGATION ===
  scrollCarousel(direction: number): void {
    const container = this.dayCarousel?.nativeElement;
    if (!container) return;

    const firstButton = container.querySelector('.tag-button') as HTMLElement;
    if (!firstButton) return;

    const gap = parseFloat(window.getComputedStyle(container).gap) || 12;
    const scrollAmount = firstButton.offsetWidth + gap;

    container.scrollTo({
      left:
        Math.round((container.scrollLeft + scrollAmount * direction) / scrollAmount) *
        scrollAmount,
      behavior: 'smooth',
    });
  }

  getDayName(dateStr: string): string {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[new Date(dateStr).getDay()];
  }

  getFormattedDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  getFormattedSelectedDay(): string {
    if (!this.selectedDate) return '';
    const parts = this.selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      return `${days[d.getDay()]} ${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return this.selectedDate;
  }

  // === LEAFLET MAP ===
  private initMap(lat: number, lng: number, name: string): void {
    if (typeof L === 'undefined') return;

    setTimeout(() => {
      const mapElement = document.getElementById('map');
      if (!mapElement) return;

      if (this.map) {
        this.map.remove();
      }

      this.map = L.map('map').setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(this.map);

      L.marker([lat, lng]).addTo(this.map).bindPopup(name).openPopup();
      this.map.invalidateSize();
    }, 200);
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-dropdown-container')) {
      this.categoryDropdownOpen = false;
    }
  }
}