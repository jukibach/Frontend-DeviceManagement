import { SelectionModel } from '@angular/cdk/collections';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { IDevice } from 'src/app/models/IDevice';
import { DeviceService } from 'src/app/services/device.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { constants } from 'src/assets/constant';
import { UpdateDeviceComponent } from '../update-device/update-device.component';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { PageEvent } from '@angular/material/paginator';
import { AddDeviceComponent } from '../add-device/add-device.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import * as saveAs from 'file-saver';
import { ImportDeviceComponent } from '../import-device/import-device.component';
import { RequestService } from 'src/app/services/request.service';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { Subject, takeUntil } from 'rxjs';

const DD_MM_YYYY_Format = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-keeping-page',
  templateUrl: './keeping-page.component.html',
  styleUrls: ['./keeping-page.component.scss'],
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_Format },
  ],
})
export class KeepingPageComponent implements OnInit, OnDestroy {
  @Output() isUpdatedSuccessful = new EventEmitter<any>();
  @Output() countNumberOfBookingDevices = new EventEmitter<any>();
  onDestroy$: Subject<boolean> = new Subject();
  selection = new SelectionModel<IDevice>(true, []);
  pageIndex: number = 0;
  pageSize: number = 10;
  totalPages: number;
  size: number;
  sortBy: string = "id";
  sortDir: string = "desc";
  dataSource = new MatTableDataSource<IDevice>();
  userId: number;
  rowIndex: number = 0;
  BOOKING_DATE: number = 10;
  RETURN_DATE: number = 11;
  roles: string[] = [];
  isLoggedIn = false;
  isAdmin = false;
  isMod = false;
  isUser = false;
  addSuccessful: string;
  addUnsuccessful: string;
  filteredValues: { [key: string]: string } = {
    name: '', status: '', platformName: '', platformVersion: '',
    itemType: '', ram: '', screen: '', storage: '', owner: '',
    keeper: '', keeperNo: '', inventoryNumber: '', serialNumber: '', origin: '', project: '', bookingDate: '', returnDate: ''
  };

  readonly columnsIndex = constants;
  readonly pageSizeOptions: number[] = [10, 20, 50, 100];
  readonly columns: string[] = ['Number', 'SerialNumber', 'DeviceName', 'Status', 'ItemType', 'PlatformName', 'PlatformVersion',
    'RamSize', 'DisplaySize', 'StorageSize', 'InventoryNumber', 'Project', 'Origin', 'Owner', 'Keeper', 'Comments', "KeeperNumber", "Date", "MaxExtending", 'Detail', 'Action'];
  readonly columnFilters: string[] = ['NumberFilter', 'SerialNumberFilter', 'DeviceNameFilter', 'StatusFilter', 'ItemTypeFilter', 'PlatformNameFilter', 'PlatformVersionFilter',
    'RamSizeFilter', 'DisplaySizeFilter', 'StorageSizeFilter', 'InventoryNumberFilter', 'ProjectFilter', 'OriginFilter', 'OwnerFilter', 'KeeperFilter', 'CommentsFilter', "KeeperNumberFilter", "DateFilter", 'maxExtending', 'Update', 'select'];

  /* Store filter options in an array*/
  readonly dropdownOptions: { [key: string]: any } = {
    status: [],
    itemType: [],
    project: [],
    origin: [],
    keeperNumberOptions: []
  }

  readonly dateFormControlnOptions: { [key: string]: any } = {
    10: new FormControl(new Date('dd/MM/yyyy')),
    11: new FormControl(new Date('dd/MM/yyyy')),
  }

  readonly keywordSuggestionOptions: { [key: string]: any } = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
    8: [],
    9: [],
  }

  readonly statusOptions: { [key: string]: any } = {
    'BROKEN': 'badge text-bg-danger p-2',
    'OCCUPIED': 'badge text-bg-warning p-2',
    'VACANT': 'badge text-bg-success  p-2',
    'UNAVAILABLE': 'badge text-bg-dark  p-2'
  }

  readonly keeperNumberDisplay: { [key: string]: any } = {
    0: 'badge text-bg-success p-2',
    1: 'badge text-bg-success p-2',
    2: 'badge text-bg-success  p-2',
    3: 'badge text-bg-danger  p-2'
  }

  constructor(private dialog: MatDialog,
    private deviceService: DeviceService,
    private _snackBar: MatSnackBar,
    private tokenStorageService: TokenStorageService,
    private requestService: RequestService) { }

  ngOnInit() {
    this.checkLogin();
    this.getAllDevicesWithPagination();
    this.checkDateInput();
  }

  ngOnDestroy() {
    this.onDestroy$.next(true);
    this.onDestroy$.unsubscribe();
  }

  applyFilterForDropdowns(date?: string) {
    this.pageIndex = 0; /* Reset index */
    this.getAllDevicesWithPagination();
  }

  changeFilterInput(event: any, key_name: (keyof typeof this.filteredValues), column: number) {
    if (this.isFilterFormEmpty(key_name)) {
      if (event === "") {
        this.changeFilterValueToEmpty(key_name);
        this.keywordSuggestionOptions[column] = [];
        return;
      }
      this.suggest(column, event);
      return;
    }
  }

  applyFilterForInputForm(e: MatAutocompleteSelectedEvent, column: string) {
    this.pageIndex = 0; /* Reset index */
    this.filteredValues = {
      ...this.filteredValues,
      [column]: e.option.value
    }
    this.getAllDevicesWithPagination();
  }

  sortData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.sortBy = sort.active;
    this.sortDir = sort.direction;
    this.getAllDevicesWithPagination()
  }

  applyFilterForDatePicker(column: string, option: string) {
    this.pageIndex = 0; /* Reset index */
    this.filteredValues = {
      ...this.filteredValues,
      [column]: String(option)
    }
    this.getAllDevicesWithPagination();
  }

  openDialogDetail(rowId: number, tableIndex: number) {
    this.dialog.open(UpdateDeviceComponent, {
      data: {
        dataKey: rowId,
        submit: true,
        index: tableIndex,
        readOnly: true
      }
    }).afterClosed().subscribe((result) => {
      if (result?.event == "Submit") {
        this.refreshDataSourceWithoutFilter();
      }
    });
  }

  suggest(column: number, keyword: string) {
    const filterValue: string = keyword.toLowerCase();
    if (filterValue.trim().length !== 0)
      this.deviceService
        .suggestKeywordForKeeperPage(this.userId, column, filterValue, this.filteredValues)
        .pipe(takeUntil(this.onDestroy$))
        .subscribe((data: any) => {
          this.keywordSuggestionOptions[column] = data['keywordList'];
        });
  }

  clearDate() {
    this.dateFormControlnOptions[this.BOOKING_DATE].reset()
    this.dateFormControlnOptions[this.RETURN_DATE].reset()
    this.filteredValues.bookingDate = '';
    this.filteredValues.returnDate = '';
    this.getAllDevicesWithPagination();
  }

  handlePagination(e: PageEvent) {
    this.size = this.size - this.pageSize;
    this.pageSize = e.pageSize;
    this.pageIndex = e.pageIndex;
    this.getAllDevicesWithPagination();
    this.selection.clear();
  }

  resetFilterValues() {
    Object.entries(this.keywordSuggestionOptions).forEach(([key]) => {
      this.keywordSuggestionOptions[key] = [];
    });
    Object.entries(this.filteredValues).forEach(([key]: any) => {
      this.filteredValues[key] = "";
    });
    this.clearDate();
  }

  openConfirmationForUpdateReturnKeepingDevice(row: any) {
    this.dialog.open(ConfirmationDialogComponent, {
      data: {
        message: "Do you really want to confirm ?",
      }
    })
      .afterClosed().subscribe(
        {
          next: (result) => {
            if (result?.event == "accept") {
              this.updateReturnKeepingDevice(row);
            }
          }
        }
      );
  }

  extendDuration(date: any, device: any) {
    this.dialog.open(ConfirmationDialogComponent, {
      data: {
        message: "Do you really want to extend ?",
      }
    })
      .afterClosed().subscribe(
        {
          next: (result) => {
            if (result?.event == "accept") {
              this.requestService
                .extendDurationForReturnDate(device.Id, device.Keeper, date.value)
                .pipe(takeUntil(this.onDestroy$))
                .subscribe({
                  next: (data) => {
                    this.notification(data.message, 'Close', "success-snackbar")
                    this.getAllDevicesWithPagination();
                  },
                  error: (error) => {
                    this.notification(error.message, 'Close', "error-snackbar")
                  }
                })
            }
          }
        }
      );
  }

  private updateReturnKeepingDevice(row: any) {
    this.deviceService
      .updateReturnKeepingdDevice(row.Id, this.userId, row.KeeperNo)
      .pipe(takeUntil(this.onDestroy$))
      .subscribe({
        next: () => {
          this.notification("UPDATED SUCCESSFULLY", 'Close', "success-snackbar")
          this.getAllDevicesWithPagination();
        },
        error: () => {
          this.notification("CANNOT RETURN BECAUSE YOUR ORDER IS THE LASTEST ORDER", 'Close', "error-snackbar")
        }
      });
  }

  private getAllDevicesWithPagination() {
    this.deviceService
      .getAllKeepingDevicesWithPagination(this.userId, this.pageSize!, this.pageIndex + 1, this.sortBy, this.sortDir, this.filteredValues)
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((data: any) => {
        this.dataSource.data = data['devicesList'];
        this.dropdownOptions.status = data['statusList'];
        this.dropdownOptions.itemType = data['itemTypeList'];
        this.dropdownOptions.project = data['projectList'];
        this.dropdownOptions.origin = data['originList'];
        this.dropdownOptions.keeperNumberOptions = data['keeperNumberOptions'];
        this.totalPages = data['totalPages'];
        this.size = data['totalElements'];
      });
  }

  private isFilterFormEmpty(key_name: (keyof typeof this.filteredValues)): boolean {
    return this.filteredValues.hasOwnProperty(key_name);
  }

  private changeFilterValueToEmpty(key_name: (keyof typeof this.filteredValues)) {
    Object.entries(this.filteredValues).find(([key]) => {
      if (key === key_name)
        this.filteredValues[key] = "";
    });
    this.getAllDevicesWithPagination();
  }

  private refreshDataSourceWithoutFilter() {
    const areFilterValuesChanged: boolean
      = Object.values(this.filteredValues).every(x => x != "");
    if (!(areFilterValuesChanged)) {
      this.getAllDevicesWithPagination();
    }
  }

  private checkDateInput() {
    this.dateFormControlnOptions[this.BOOKING_DATE].valueChanges
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((value: string) => {
        if (value != "" && value != null)
          this.applyFilterForDatePicker("bookingDate", value);
      })

    this.dateFormControlnOptions[this.RETURN_DATE].valueChanges
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((value: string) => {
        if (value != "" && value != null)
          this.applyFilterForDatePicker("returnDate", value);
      })
  }

  private checkLogin() {
    this.isLoggedIn = this.tokenStorageService.isLoggedIn();
    if (this.isLoggedIn) {
      const user = this.tokenStorageService.getUser();
      this.roles = user.roles;
      this.isAdmin = this.roles.includes('ROLE_ADMIN');
      this.isMod = this.roles.includes('ROLE_MODERATOR');
      this.isUser = this.roles.includes('ROLE_USER');
      this.userId = user.id;
    }
  }

  private notification(message: string, action: string, className: string) {
    this._snackBar.open(message, action, {
      horizontalPosition: "right",
      verticalPosition: "top",
      duration: 4000,
      panelClass: [className]
    });
  }
}
