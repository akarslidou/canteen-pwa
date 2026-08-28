import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HardwareService } from './services/hardware.service';
import { CanteenService, DaySchedule } from './services/canteen.service';
import {
  Canteen,
  Meal,
  UNIVERSITY_CANTEENS,
} from './models/canteen.model';

declare const L: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit, AfterViewInit {
  universityCanteens = UNIVERSITY_CANTEENS;
  currentUniKey: string = 'tuebingen';
  selectedCanteen: Canteen = UNIVERSITY_CANTEENS['tuebingen'][0];

  sidebarOpen = false;
  inlineDropdownOpen = false;
  categoryDropdownOpen = false;
  priceDropdownOpen = false;

  isLoading = false;
  isClosed = false;
  isOfflineError = false;
  hasNoData = false;

  availableDays: DaySchedule[] = [];
  selectedDate: string = '';
  meals: Meal[] = [];

  activePriceType: 'students' | 'employees' | 'others' = 'students';
  activeFilterKeywords: string[] = [];
  expandedNotes: Record<string, boolean> = {};

  @ViewChild('dayCarousel') dayCarousel!: ElementRef<HTMLDivElement>;

  private map: any = null;

  constructor(
    public hardwareService: HardwareService,
    public canteenService: CanteenService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.selectUniversity('tuebingen', false);

    window.addEventListener('offline', () => {
      this.ngZone.run(() => {
        this.isOfflineError = true;
        this.cdr.detectChanges();
      });
    });

    window.addEventListener('online', () => {
      this.ngZone.run(() => {
        this.isOfflineError = false;
        this.loadMealsForDate(this.selectedDate);
      });
    });
  }

  ngAfterViewInit(): void {
    if (this.selectedCanteen) {
      setTimeout(() => {
        this.initMap(this.selectedCanteen.lat, this.selectedCanteen.lng, this.selectedCanteen.name);
      }, 200);
    }
  }

  // === MENSEN & UNIVERSITÄTEN ===
  selectUniversity(uniKey: string, closeMenu = true): void {
    this.currentUniKey = uniKey;
    const canteens = this.universityCanteens[uniKey];
    if (canteens && canteens.length > 0) {
      this.selectedCanteen = canteens[0];
      this.inlineDropdownOpen = false;
      this.resetMealsAndReload();
      setTimeout(() => {
        this.initMap(canteens[0].lat, canteens[0].lng, canteens[0].name);
      }, 100);
    }
    if (closeMenu) {
      this.sidebarOpen = false;
    }
  }

  selectCanteen(canteen: Canteen): void {
    this.selectedCanteen = canteen;
    this.inlineDropdownOpen = false;
    this.resetMealsAndReload();
    setTimeout(() => {
      this.initMap(canteen.lat, canteen.lng, canteen.name);
    }, 100);
  }

  get inlineDropdownCanteens(): Canteen[] {
    const list = this.universityCanteens[this.currentUniKey] || [];
    return list.filter((c) => c.id !== this.selectedCanteen?.id);
  }

  // === DATEN LADEN & RENDERN WIE IN APP.JS ===
  async resetMealsAndReload(): Promise<void> {
    this.ngZone.run(() => {
      this.meals = [];
      this.isClosed = false;
      this.isOfflineError = false;
      this.hasNoData = false;
      this.isLoading = true;
      this.cdr.detectChanges();
    });

    if (!this.selectedCanteen) return;

    try {
      const days = await this.canteenService.fetchAvailableDays(this.selectedCanteen.id);
      
      this.ngZone.run(() => {
        this.availableDays = days || [];
        if (
          !this.selectedDate ||
          !this.availableDays.some((d) => d.date === this.selectedDate)
        ) {
          this.selectedDate = this.availableDays[0]?.date || '';
        }
        this.cdr.detectChanges();
      });

      if (this.selectedDate) {
        await this.loadMealsForDate(this.selectedDate);
      }

      this.canteenService.prefetchUpcomingDays(
        this.selectedCanteen.id,
        this.availableDays,
        this.selectedDate
      );
    } catch (e) {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.hasNoData = true;
        this.cdr.detectChanges();
      });
    }
  }

  async selectDate(date: string): Promise<void> {
    if (this.selectedDate === date && this.meals.length > 0) return;
    this.selectedDate = date;
    await this.loadMealsForDate(date);
  }

  async loadMealsForDate(date: string): Promise<void> {
    if (!date || !this.selectedCanteen) return;

    this.ngZone.run(() => {
      this.isLoading = true;
      this.isClosed = false;
      this.isOfflineError = false;
      this.hasNoData = false;
      this.meals = [];
      this.cdr.detectChanges();
    });

    try {
      const fetchedMeals = await this.canteenService.fetchMealsForDate(
        this.selectedCanteen.id,
        date
      );

      this.ngZone.run(() => {
        this.meals = fetchedMeals || [];

        if (!navigator.onLine) {
          this.isOfflineError = true;
        }

        if (this.meals.length === 0) {
          const dayMeta = this.availableDays.find((d) => d.date === date);
          if (dayMeta && dayMeta.closed) {
            this.isClosed = true;
          } else {
            this.hasNoData = true;
          }
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } catch {
      this.ngZone.run(() => {
        this.meals = [];
        if (!navigator.onLine) {
          this.isOfflineError = true;
        } else {
          this.hasNoData = true;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  // === FILTER & PREISE ===
  toggleDropdown(type: 'category' | 'price'): void {
    if (type === 'category') {
      this.categoryDropdownOpen = !this.categoryDropdownOpen;
      this.priceDropdownOpen = false;
    } else {
      this.priceDropdownOpen = !this.priceDropdownOpen;
      this.categoryDropdownOpen = false;
    }
  }

  closeAllDropdowns(): void {
    this.inlineDropdownOpen = false;
    this.categoryDropdownOpen = false;
    this.priceDropdownOpen = false;
  }

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
    this.priceDropdownOpen = false;
  }

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

  getLegendIconPath(category: string): string | null {
  return this.getIconPath({
    id: 0,
    name: category,
    category: category,
    notes: [category],
    prices: {}
  } as Meal);
}

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

  openMapLocation(): void {
    if (this.selectedCanteen) {
      const url = `https://www.openstreetmap.org/?mlat=${this.selectedCanteen.lat}&mlon=${this.selectedCanteen.lng}#map=17/${this.selectedCanteen.lat}/${this.selectedCanteen.lng}`;
      window.open(url, '_blank');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-dropdown-container')) {
      this.categoryDropdownOpen = false;
      this.priceDropdownOpen = false;
    }
  }
}