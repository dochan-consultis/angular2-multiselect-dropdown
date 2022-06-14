import {
  Component,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  OnDestroy,
  NgModule,
  SimpleChanges,
  OnChanges,
  ChangeDetectorRef,
  AfterViewChecked,
  ViewEncapsulation,
  ContentChild,
  ViewChild,
  forwardRef,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  AfterViewInit,
  Pipe,
  PipeTransform, DoCheck
} from '@angular/core';
import {
  FormsModule,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  NG_VALIDATORS,
  Validator,
  FormControl
} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MyException} from './multiselect.model';
import {DropdownSettings} from './multiselect.interface';
import {ClickOutsideDirective, ScrollDirective, styleDirective, setPosition} from './clickOutside';
import {ListFilterPipe} from './list-filter';
import {Item, Badge, Search, TemplateRenderer, CIcon} from './menu-item';
import {DataService} from './multiselect.service';
import {Subscription, Subject} from 'rxjs';
import {VirtualScrollerModule, VirtualScrollerComponent} from './virtual-scroll/virtual-scroll';
import {map, debounceTime, distinctUntilChanged, switchMap, tap} from 'rxjs/operators';


export const DROPDOWN_CONTROL_VALIDATION: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => AngularMultiSelect),
  multi: true,
};
const noop = () => {
};

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'grafit-angular2-multiselect',
  templateUrl: './multiselect.component.html',
  // tslint:disable-next-line:no-host-metadata-property
  host: {'[class]': 'defaultSettings.classes'},
  styleUrls: ['./multiselect.component.scss'],
  providers: [DROPDOWN_CONTROL_VALIDATION],
  encapsulation: ViewEncapsulation.None,
})

// tslint:disable-next-line:component-class-suffix
export class AngularMultiSelect implements OnInit, OnChanges, Validator, AfterViewChecked, AfterViewInit, OnDestroy, DoCheck {
  constructor(public _elementRef: ElementRef, private cdr: ChangeDetectorRef, private ds: DataService) {
    this.searchTerm$.asObservable().pipe(
      debounceTime(1000),
      distinctUntilChanged(),
      tap(term => term)
    ).subscribe(val => {
      this.filterInfiniteList(val);
    });
  }

  @Input()
  data: Array<any>;

  @Input()
  selection: Array<any>;

  @Input()
  settings: DropdownSettings;

  @Input()
  loading: boolean;

  @Output()
  selectionChange: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onDeSelect')
  onDeSelect: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onSelectAll')
  onSelectAll: EventEmitter<Array<any>> = new EventEmitter<Array<any>>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onDeSelectAll')
  onDeSelectAll: EventEmitter<Array<any>> = new EventEmitter<Array<any>>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onOpen')
  onOpen: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onClose')
  onClose: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onScrollToEnd')
  onScrollToEnd: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onFilterSelectAll')
  onFilterSelectAll: EventEmitter<Array<any>> = new EventEmitter<Array<any>>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onFilterDeSelectAll')
  onFilterDeSelectAll: EventEmitter<Array<any>> = new EventEmitter<Array<any>>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onAddFilterNewItem')
  onAddFilterNewItem: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onGroupSelect')
  onGroupSelect: EventEmitter<any> = new EventEmitter<any>();

  // tslint:disable-next-line:no-output-on-prefix no-output-rename
  @Output('onGroupDeSelect')
  onGroupDeSelect: EventEmitter<any> = new EventEmitter<any>();

  @ContentChild(Item, {static: true}) itemTempl: Item;
  @ContentChild(Badge, {static: true}) badgeTempl: Badge;
  @ContentChild(Search, {static: true}) searchTempl: Search;


  @ViewChild('searchInput', {static: true}) searchInput: ElementRef;
  @ViewChild('selectedList', {static: true}) selectedListElem: ElementRef;
  @ViewChild('dropdownList', {static: true}) dropdownListElem: ElementRef;
  virtualdata: any = [];
  searchTerm$ = new Subject<string>();

  filterPipe: ListFilterPipe;
  public isActive = false;
  public isSelectAll = false;
  public isFilterSelectAll = false;
  public isInfiniteFilterSelectAll = false;
  public groupedData: Array<any>;
  filter: any;
  public chunkArray: any[];
  public scrollTop: any;
  public chunkIndex: any[] = [];
  public cachedItems: any[] = [];
  public groupCachedItems: any[] = [];
  public totalRows: any;
  public itemHeight: any = 41.6;
  public screenItemsLen: any;
  public cachedItemsLen: any;
  public totalHeight: any;
  public scroller: any;
  public maxBuffer: any;
  public lastScrolled: any;
  public lastRepaintY: any;
  public selectedListHeight: any;
  public filterLength: any = 0;
  public infiniteFilterLength: any = 0;
  public viewPortItems: any;
  public item: any;
  public dropdownListYOffset = 0;
  subscription: Subscription;
  defaultSettings: DropdownSettings = {
    singleSelection: false,
    text: 'Select',
    enableCheckAll: true,
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    filterSelectAllText: 'Select all filtered results',
    filterUnSelectAllText: 'UnSelect all filtered results',
    enableSearchFilter: false,
    searchBy: [],
    maxHeight: 300,
    badgeShowLimit: 999999999999,
    classes: '',
    disabled: false,
    searchPlaceholderText: 'Search',
    showCheckbox: true,
    noDataLabel: 'No Data Available',
    searchAutofocus: true,
    lazyLoading: false,
    labelKey: 'itemName',
    primaryKey: 'id',
    position: 'bottom',
    autoPosition: true,
    enableFilterSelectAll: true,
    selectGroup: false,
    addNewItemOnFilter: false,
    addNewButtonText: 'Add',
    escapeToClose: true,
    clearAll: true
  };
  randomSize = true;
  public parseError: boolean;
  public filteredList: any = [];
  virtualScroollInit = false;
  @ViewChild(VirtualScrollerComponent, {static: false})
  private virtualScroller: VirtualScrollerComponent;
  _settings: DropdownSettings;

  @HostListener('document:keyup.escape', ['$event'])
  onEscapeDown(event: KeyboardEvent) {
    if (this._settings.escapeToClose) {
      this.closeDropdown();
    }
  }

  ngOnInit() {

    this.cachedItems = this.cloneArray(this.data);

    if (this._settings.position === 'top') {
      setTimeout(() => {
        this.selectedListHeight = {val: 0};
        this.selectedListHeight.val = this.selectedListElem.nativeElement.clientHeight;
      });
    }
    this.subscription = this.ds.getData().subscribe(data => {
      if (data) {
        let len = 0;
        data.forEach((obj: any, i: any) => {
          if (!obj.hasOwnProperty('grpTitle')) {
            len++;
          }
        });
        this.filterLength = len;
        this.onFilterChange(data);
      }

    });
    setTimeout(() => {
      this.calculateDropdownDirection();
    });
    this.virtualScroollInit = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.settings) {
      this._settings = Object.assign({}, this.defaultSettings, this.settings);
    }

    if (changes.data) {
      if (this._settings.groupBy) {
        this.groupedData = this.transformData(this.data, this._settings.groupBy);
        if (this.data.length === 0) {
          this.selection = [];
        }
      }
      this.cachedItems = this.cloneArray(this.data);
    }
    if (changes.loading) {
      console.log(this.loading);
    }

    // not set to this._settings on purpose
    if (this.settings.lazyLoading && this.virtualScroollInit && changes.data) {
      this.virtualdata = changes.data.currentValue;
    }
  }

  ngDoCheck() {
    if (this.selection) {
      if (this.selection.length === 0 || this.data.length === 0 || this.selection.length < this.data.length) {
        this.isSelectAll = false;
      }
    }
  }

  ngAfterViewInit() {
    if (this._settings.lazyLoading) {
      // this._elementRef.nativeElement.getElementsByClassName("lazyContainer")[0].addEventListener('scroll', this.onScroll.bind(this));
    }
  }

  ngAfterViewChecked() {
    if (this.selectedListElem.nativeElement.clientHeight && this._settings.position === 'top' && this.selectedListHeight) {
      this.selectedListHeight.val = this.selectedListElem.nativeElement.clientHeight;
      this.cdr.detectChanges();
    }
  }

  onItemClick(item: any, index: number, evt: Event) {
    if (this._settings.disabled) {
      return false;
    }

    const found = this.isSelected(item);
    const limit = this.selection.length < this._settings.limitSelection ? true : false;

    if (!found) {
      if (this._settings.limitSelection) {
        if (limit) {
          this.addSelected(item);
          this.selectionChange.emit(this.selection);
        }
      } else {
        this.addSelected(item);
        this.selectionChange.emit(this.selection);
      }

    } else {
      this.removeSelected(item);
      this.onDeSelect.emit(item);
    }
    if (this.isSelectAll || this.data.length > this.selection.length) {
      this.isSelectAll = false;
    }
    if (this.data.length === this.selection.length) {
      this.isSelectAll = true;
    }
    if (this._settings.groupBy) {
      this.updateGroupInfo(item);
    }
  }

  public validate(c: FormControl): any {
    return null;
  }

  writeValue(value: any) {
    if (value !== undefined && value !== null && value !== '') {
      if (this._settings.singleSelection) {
        if (this._settings.groupBy) {
          this.groupedData = this.transformData(this.data, this._settings.groupBy);
          this.groupCachedItems = this.cloneArray(this.groupedData);
          this.selection = [value[0]];
        } else {
          try {

            if (value.length > 1) {
              this.selection = [value[0]];
              throw new MyException(404, {'msg': 'Single Selection Mode, Selected Items cannot have more than one item.'});
            } else {
              this.selection = value;
            }
          } catch (e) {
            console.error(e.body.msg);
          }
        }

      } else {
        if (this._settings.limitSelection) {
          this.selection = value.slice(0, this._settings.limitSelection);
        } else {
          this.selection = value;
        }
        if (this.selection.length === this.data.length && this.data.length > 0) {
          this.isSelectAll = true;
        }
        if (this._settings.groupBy) {
          this.groupedData = this.transformData(this.data, this._settings.groupBy);
          this.groupCachedItems = this.cloneArray(this.groupedData);
        }
      }
    } else {
      this.selection = [];
    }
  }

  trackByFn(index: number, item: any) {
    return item[this._settings.primaryKey];
  }

  isSelected(clickedItem: any) {
    let found = false;
    if (this.selection) {
      this.selection.forEach(item => {
        if (clickedItem[this._settings.primaryKey] === item[this._settings.primaryKey]) {
          found = true;
        }
      });
    }
    return found;
  }

  addSelected(item: any) {
    if (this._settings.singleSelection) {
      this.selection = [];
      this.selection.push(item);
      this.closeDropdown();
    } else {
      this.selection.push(item);
    }
  }

  removeSelected(clickedItem: any) {
    if (this.selection) {
      this.selection.forEach(item => {
        if (clickedItem[this._settings.primaryKey] === item[this._settings.primaryKey]) {
          this.selection.splice(this.selection.indexOf(item), 1);
        }
      });
    }
  }

  toggleDropdown(evt: any) {
    if (this._settings.disabled) {
      return false;
    }
    this.isActive = !this.isActive;
    if (this.isActive) {
      if (this._settings.searchAutofocus && this.searchInput && this._settings.enableSearchFilter && !this.searchTempl) {
        setTimeout(() => {
          this.searchInput.nativeElement.focus();
        }, 0);
      }
      this.onOpen.emit(true);
    } else {
      this.onClose.emit(false);
    }
    setTimeout(() => {
      this.calculateDropdownDirection();
    }, 0);
    if (this._settings.lazyLoading) {
      this.virtualdata = this.data;
      this.virtualScroollInit = true;
    }
    evt.preventDefault();
  }

  public openDropdown() {
    if (this._settings.disabled) {
      return false;
    }
    this.isActive = true;
    if (this._settings.searchAutofocus && this.searchInput && this._settings.enableSearchFilter && !this.searchTempl) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      }, 0);
    }
    this.onOpen.emit(true);
  }

  public closeDropdown() {
    if (this.searchInput && this._settings.lazyLoading) {
      this.searchInput.nativeElement.value = '';
    }
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    this.filter = '';
    this.isActive = false;
    this.onClose.emit(false);
  }

  public closeDropdownOnClickOut() {
    if (this.isActive) {
      if (this.searchInput && this._settings.lazyLoading) {
        this.searchInput.nativeElement.value = '';
      }
      if (this.searchInput) {
        this.searchInput.nativeElement.value = '';
      }
      this.filter = '';
      this.isActive = false;
      this.clearSearch();
      this.onClose.emit(false);
    }
  }

  toggleSelectAll() {
    if (!this.isSelectAll) {
      this.selection = [];
      if (this._settings.groupBy) {
        this.groupedData.forEach((obj) => {
          obj.selected = true;
        });
        this.groupCachedItems.forEach((obj) => {
          obj.selected = true;
        });
      }
      this.selection = this.data.slice();
      this.isSelectAll = true;

      this.onSelectAll.emit(this.selection);
    } else {
      if (this._settings.groupBy) {
        this.groupedData.forEach((obj) => {
          obj.selected = false;
        });
        this.groupCachedItems.forEach((obj) => {
          obj.selected = false;
        });
      }
      this.selection = [];
      this.isSelectAll = false;

      this.onDeSelectAll.emit(this.selection);
    }
  }

  filterGroupedList() {
    if (this.filter === '' || this.filter == null) {
      this.clearSearch();
      return;
    }
    this.groupedData = this.cloneArray(this.groupCachedItems);
    this.groupedData = this.groupedData.filter(obj => {
      const arr = obj.list.filter(t => {
        return t.itemName.toLowerCase().indexOf(this.filter.toLowerCase()) > -1;
      });
      obj.list = arr;
      return arr.some(cat => {
          return cat.itemName.toLowerCase().indexOf(this.filter.toLowerCase()) > -1;
        }
      );
    });
    console.log(this.groupedData);
  }

  toggleFilterSelectAll() {
    if (!this.isFilterSelectAll) {
      const added = [];
      if (this._settings.groupBy) {
        this.groupedData.forEach((item: any) => {
          if (item.list) {
            item.list.forEach((el: any) => {
              if (!this.isSelected(el)) {
                this.addSelected(el);
                added.push(el);
              }
            });
          }
          this.updateGroupInfo(item);

        });

      } else {
        this.ds.getFilteredData().forEach((item: any) => {
          if (!this.isSelected(item)) {
            this.addSelected(item);
            added.push(item);
          }

        });
      }

      this.isFilterSelectAll = true;
      this.onFilterSelectAll.emit(added);
    } else {
      const removed = [];
      if (this._settings.groupBy) {
        this.groupedData.forEach((item: any) => {
          if (item.list) {
            item.list.forEach((el: any) => {
              if (this.isSelected(el)) {
                this.removeSelected(el);
                removed.push(el);
              }
            });
          }
        });
      } else {
        this.ds.getFilteredData().forEach((item: any) => {
          if (this.isSelected(item)) {
            this.removeSelected(item);
            removed.push(item);
          }

        });
      }
      this.isFilterSelectAll = false;
      this.onFilterDeSelectAll.emit(removed);
    }
  }

  toggleInfiniteFilterSelectAll() {
    if (!this.isInfiniteFilterSelectAll) {
      this.data.forEach((item: any) => {
        if (!this.isSelected(item)) {
          this.addSelected(item);
        }

      });
      this.isInfiniteFilterSelectAll = true;
    } else {
      this.data.forEach((item: any) => {
        if (this.isSelected(item)) {
          this.removeSelected(item);
        }

      });
      this.isInfiniteFilterSelectAll = false;
    }
  }

  clearSearch() {
    if (this._settings.groupBy) {
      this.groupedData = [];
      this.groupCachedItems.forEach((obj) => {
        obj.selected = false;
      });
      this.groupedData = this.cloneArray(this.groupCachedItems);
    }
    this.filter = '';
    this.isFilterSelectAll = false;

  }

  onFilterChange(data: any) {
    if (this.filter && this.filter === '' || data.length === 0) {
      this.isFilterSelectAll = false;
    }
    let cnt = 0;
    data.forEach((item: any) => {

      if (!item.hasOwnProperty('grpTitle') && this.isSelected(item)) {
        cnt++;
      }
    });

    if (cnt > 0 && this.filterLength === cnt) {
      this.isFilterSelectAll = true;
    } else if (cnt > 0 && this.filterLength !== cnt) {
      this.isFilterSelectAll = false;
    }
    this.cdr.detectChanges();
  }

  cloneArray(arr: any) {

    if (Array.isArray(arr)) {
      return JSON.parse(JSON.stringify(arr));
    } else if (typeof arr === 'object') {
      throw new Error('Cannot clone array containing an object!');
    } else {
      return arr;
    }
  }

  updateGroupInfo(item: any) {
    const key = this._settings.groupBy;
    this.groupedData.forEach((obj: any) => {
      let cnt = 0;
      if (obj.grpTitle && (item[key] === obj[key])) {
        if (obj.list) {
          obj.list.forEach((el: any) => {
            if (this.isSelected(el)) {
              cnt++;
            }
          });
        }
      }
      if (obj.list && (cnt === obj.list.length) && (item[key] === obj[key])) {
        obj.selected = true;
      } else if (obj.list && (cnt !== obj.list.length) && (item[key] === obj[key])) {
        obj.selected = false;
      }
    });
    this.groupCachedItems.forEach((obj: any) => {
      let cnt = 0;
      if (obj.grpTitle && (item[key] === obj[key])) {
        if (obj.list) {
          obj.list.forEach((el: any) => {
            if (this.isSelected(el)) {
              cnt++;
            }
          });
        }
      }
      if (obj.list && (cnt === obj.list.length) && (item[key] === obj[key])) {
        obj.selected = true;
      } else if (obj.list && (cnt !== obj.list.length) && (item[key] === obj[key])) {
        obj.selected = false;
      }
    });
  }

  transformData(arr: Array<any>, field: any): Array<any> {
    const groupedObj: any = arr.reduce((prev: any, cur: any) => {
      if (!prev[cur[field]]) {
        prev[cur[field]] = [cur];
      } else {
        prev[cur[field]].push(cur);
      }
      return prev;
    }, {});
    const tempArr: any = [];
    Object.keys(groupedObj).map((x: any) => {
      const obj: any = {};
      obj['grpTitle'] = true;
      obj[this._settings.labelKey] = x;
      obj[this._settings.groupBy] = x;
      obj['selected'] = false;
      obj['list'] = [];
      let cnt = 0;
      groupedObj[x].forEach((item: any) => {
        item['list'] = [];
        obj.list.push(item);
        if (this.isSelected(item)) {
          cnt++;
        }
      });
      if (cnt === obj.list.length) {
        obj.selected = true;
      } else {
        obj.selected = false;
      }
      tempArr.push(obj);
      // obj.list.forEach((item: any) => {
      //     tempArr.push(item);
      // });
    });
    return tempArr;
  }

  public filterInfiniteList(evt: any) {
    const filteredElems: Array<any> = [];
    if (this._settings.groupBy) {
      this.groupedData = this.groupCachedItems.slice();
    } else {
      this.data = this.cachedItems.slice();
      this.virtualdata = this.cachedItems.slice();
    }

    if ((evt !== null || evt !== '') && !this._settings.groupBy) {
      if (this._settings.searchBy.length > 0) {
        for (let t = 0; t < this._settings.searchBy.length; t++) {

          this.virtualdata.filter((el: any) => {
            if (el[this._settings.searchBy[t].toString()].toString().toLowerCase().indexOf(evt.toString().toLowerCase()) >= 0) {
              filteredElems.push(el);
            }
          });
        }

      } else {
        this.virtualdata.filter(function (el: any) {
          for (const prop in el) {
            if (el[prop].toString().toLowerCase().indexOf(evt.toString().toLowerCase()) >= 0) {
              filteredElems.push(el);
              break;
            }
          }
        });
      }
      this.virtualdata = [];
      this.virtualdata = filteredElems;
      this.infiniteFilterLength = this.virtualdata.length;
    }
    if (evt.toString() !== '' && this._settings.groupBy) {
      this.groupedData.filter(function (el: any) {
        if (el.hasOwnProperty('grpTitle')) {
          filteredElems.push(el);
        } else {
          for (const prop in el) {
            if (el[prop].toString().toLowerCase().indexOf(evt.toString().toLowerCase()) >= 0) {
              filteredElems.push(el);
              break;
            }
          }
        }
      });
      this.groupedData = [];
      this.groupedData = filteredElems;
      this.infiniteFilterLength = this.groupedData.length;
    } else if (evt.toString() === '' && this.cachedItems.length > 0) {
      this.virtualdata = [];
      this.virtualdata = this.cachedItems;
      this.infiniteFilterLength = 0;
    }
    this.virtualScroller.refresh();
  }

  resetInfiniteSearch() {
    this.filter = '';
    this.isInfiniteFilterSelectAll = false;
    this.virtualdata = [];
    this.virtualdata = this.cachedItems;
    this.groupedData = this.groupCachedItems;
    this.infiniteFilterLength = 0;
  }

  onScrollEnd(e: any) {
    if (e.endIndex === this.data.length - 1 || e.startIndex === 0) {

    }
    this.onScrollToEnd.emit(e);

  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

  }

  selectGroup(item: any) {
    if (item.selected) {
      item.selected = false;
      item.list.forEach((obj: any) => {
        this.removeSelected(obj);
      });
      this.updateGroupInfo(item);
      this.onGroupSelect.emit(item);
    } else {
      item.selected = true;
      item.list.forEach((obj: any) => {
        if (!this.isSelected(obj)) {
          this.addSelected(obj);
        }

      });
      this.updateGroupInfo(item);
      this.onGroupDeSelect.emit(item);
    }


  }

  addFilterNewItem() {
    this.onAddFilterNewItem.emit(this.filter);
    this.filterPipe = new ListFilterPipe(this.ds);
    this.filterPipe.transform(this.data, this.filter, this._settings.searchBy);
  }

  calculateDropdownDirection() {
    const shouldOpenTowardsTop = this._settings.position === 'top';
    if (this._settings.autoPosition) {
      const dropdownHeight = this.dropdownListElem.nativeElement.clientHeight;
      const viewportHeight = document.documentElement.clientHeight;
      const selectedListBounds = this.selectedListElem.nativeElement.getBoundingClientRect();

      const spaceOnTop: number = selectedListBounds.top;
      const spaceOnBottom: number = viewportHeight - selectedListBounds.top;
      if (spaceOnBottom < spaceOnTop && dropdownHeight < spaceOnTop) {
        this.openTowardsTop(true);
      } else {
        this.openTowardsTop(false);
      }
      // Keep preference if there is not enough space on either the top or bottom
      /* 			if (spaceOnTop || spaceOnBottom) {
                      if (shouldOpenTowardsTop) {
                          shouldOpenTowardsTop = spaceOnTop;
                      } else {
                          shouldOpenTowardsTop = !spaceOnBottom;
                      }
                  } */
    }

  }

  openTowardsTop(value: boolean) {
    if (value && this.selectedListElem.nativeElement.clientHeight) {
      this.dropdownListYOffset = 15 + this.selectedListElem.nativeElement.clientHeight;
    } else {
      this.dropdownListYOffset = 0;
    }
  }

  clearSelection(e: any) {
    this.clearSearch();
    this.selection = [];
    this.onDeSelectAll.emit(this.selection);
  }
}

@NgModule({
  imports: [CommonModule, FormsModule, VirtualScrollerModule],
  declarations: [
    AngularMultiSelect,
    ClickOutsideDirective,
    ScrollDirective,
    styleDirective,
    ListFilterPipe,
    Item,
    TemplateRenderer,
    Badge,
    Search,
    setPosition,
    CIcon
  ],
  exports: [
    AngularMultiSelect,
    ClickOutsideDirective,
    ScrollDirective,
    styleDirective,
    ListFilterPipe,
    Item,
    TemplateRenderer,
    Badge,
    Search,
    setPosition,
    CIcon
  ],
  providers: [DataService]
})
export class AngularMultiSelectModule {
}
