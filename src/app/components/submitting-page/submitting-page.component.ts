import { SelectionModel } from '@angular/cdk/collections';
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { IDevice } from 'src/app/models/IDevice';
import { IRequest } from 'src/app/models/IRequest';
import { LocalService } from 'src/app/services/local.service';
import { UserService } from 'src/app/services/user.service';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RequestService } from 'src/app/services/request.service';
import { UpdateDeviceComponent } from '../update-device/update-device.component';
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
  selector: 'app-submitting-page',
  templateUrl: './submitting-page.component.html',
  styleUrls: ['./submitting-page.component.scss'],
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_Format },
  ],
})
export class SubmittingPageComponent implements OnInit, OnDestroy {
  @Output() recount = new EventEmitter<any>();

  submitted = false;
  minDate: Date;
  nextKeeperOptions = [];
  requests = new MatTableDataSource<IRequest>();
  selection = new SelectionModel<any>(true, []);
  readonly NEXT_KEEPER: number = 1;
  readonly BOOKING_DATE: number = 2;
  readonly RETURN_DATE: number = 3;
  userInfo: any;
  nextKeeper = new FormControl();
  onDestroy$: Subject<boolean> = new Subject();
  readonly formControlnOptions: { [key: string]: any } = {
    1: new FormControl(),
    2: new FormControl(),
    3: new FormControl(),
  }

  filteredValues: { [key: string]: string } = {
    name: '', status: '', platformName: '', platformVersion: '',
    itemType: '', ram: '', screen: '', storage: '', owner: '',
    keeper: '', inventoryNumber: '', serialNumber: '', origin: '', project: '', bookingDate: '', returnDate: ''
  };

  readonly columns: string[] = ['Number', 'Detail', 'SerialNumber', 'Requester', 'CurrentKeeper', 'NextKeeper', 'DeviceName', 'ItemType', 'PlatformName', 'PlatformVersion',
    'RamSize', 'DisplaySize', 'StorageSize', 'InventoryNumber', 'Comments', "Date", 'Action'];

  constructor(
    public dialogRef: MatDialogRef<SubmittingPageComponent>,
    @Inject(MAT_DIALOG_DATA) public data: string,
    private localService: LocalService,
    private userService: UserService,
    private dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private requestService: RequestService
  ) {
  }

  ngOnInit(): void {
    this.getDataFromStorage();
  }

  ngOnDestroy() {
    this.onDestroy$.next(true);
    this.onDestroy$.unsubscribe();
  }

  getDataFromStorage() {
    this.requests.data = this.dataStorage();
  }

  dataStorage() {
    let archive: any[] = [],
      keys = Object.keys(localStorage),
      i = keys.length;
    while (i--) {
      archive[keys[i] as any] = JSON.parse(this.localService.getData(keys[i]));
    }
    return archive.filter(a => a);
  }

  onNoClick(): void {
    this.requests.data.forEach(data => {
      const request: IRequest = {
        currentKeeper: data.currentKeeper,
        nextKeeper: data.nextKeeper,
        bookingDate: data.bookingDate,
        returnDate: data.returnDate,
        deviceId: data.deviceId,
        itemType: data.itemType,
        deviceName: data.deviceName,
        platformName: data.platformName,
        platformVersion: data.platformVersion,
        ramSize: data.ramSize,
        screenSize: data.screenSize,
        inventoryNumber: data.inventoryNumber,
        serialNumber: data.serialNumber,
        Id: data.Id,
        ticketId: '',
        requester: data.requester,
        storageSize: data.storageSize
      };
      this.localService.saveData(String(request.Id), JSON.stringify(request));
    })
    this.dialogRef.close({ event: "Cancel" });
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.requests.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.requests.data);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: IDevice, index?: number): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${index}`;
  }

  changeNextKeeper(event: any) {
    if (event != "" && event != null) {
      this.employeeSuggestion(this.NEXT_KEEPER, event);
      return;
    }
    this.nextKeeperOptions = [];
  }

  onSubmit(): void {
    const dialogRef = this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          message: "Are you sure that you want to submit ?",
        }
      });
    const requestsList: { deviceId: number; requester: string; nextKeeper: string; bookingDate: string | undefined; returnDate: string | undefined; }[] = [];
    this.requests.data.forEach((element) => {
      const request = {
        "deviceId": element.deviceId,
        "requester": element.requester,
        "nextKeeper": element.nextKeeper,
        "bookingDate": element.bookingDate,
        "returnDate": element.returnDate
      }
      requestsList.push(request);
    })
    const input = { "requestsList": requestsList }
    dialogRef.afterClosed().subscribe({
      next: (result) => {
        if (result.event == "accept") {
          this.requestService.submitRequests(input)
            .pipe(takeUntil(this.onDestroy$))
            .subscribe({
              next: (response: any) => {
                this.returnSubmitError(response["failedRequestsList"]);
              },
              error: (error) => {
                this.notification(error, 'Close', "error-snackbar")
                throw error;
              },
            }
            );
        }
      },
      error: (error) => {
        console.error(error);
      }
    });
  }

  deleteDevice() {
    const dialogRef = this.dialog.
      open(ConfirmationDialogComponent, {
        data: {
          message: "Do you want to remove this device ? ",
        }
      });
    dialogRef.afterClosed().subscribe({
      next: (result) => {
        if (result.event == "accept") {
          if (this.selection.selected.length != 0) {
            for (var device of this.selection.selected) {
              this.localService.removeData(device.Id.toString());
              this.getDataFromStorage();
              this.notification('REMOVED SUCCESSFULLY', 'Close', "error-snackbar");
              this.recount.emit()
            }
          }

        }
      },
      error: (error) => {
        console.log(error);
      },
    });
  }

  removeAll() {
    const dialogRef = this.dialog
      .open(ConfirmationDialogComponent, {
        data:
        {
          message: "Are you sure you want to remove all ?"
        }
      });
    dialogRef.afterClosed().subscribe({
      next: (result) => {
        if (result.event == "accept") {
          this.localService.clearData();
          this.notification('REMOVED SUCCESSFULLY', 'Close', "error-snackbar");
          this.getDataFromStorage();
          this.recount.emit();
        }
      }
    });
  }

  openDialogUpdate(rowId: number, tableIndex: number) {
    this.dialog.open(UpdateDeviceComponent, {
      data: {
        dataKey: rowId,
        submit: true,
        index: tableIndex,
        readOnly: true
      }
    });
  }

  private returnSubmitError(response: any) {
    let failResponse: any[] = []
    for (let index = 0; index < response.length; index++)
      failResponse.push("No " + Number(index + 1) + " :[" + response[index].errorMessage + "]")
    if (this.areThereSubmitErrors(failResponse)) {
      let spots = failResponse.join("\r\n");
      let message = `${spots}`;
      this.notification(message, 'Close', "error-snackbar")
      return;
    }
    this.notification("SUBMITTED SUCCESSFULLY", 'Close', "success-snackbar")
    this.dialogRef.close({ event: "Submit" });
    this.localService.clearData();
  }

  private areThereSubmitErrors(failResponse: string[]) {
    return failResponse.length >= 1;
  }

  private employeeSuggestion(column: number, keyword: string): void {
    this.userService.suggest(column, keyword)
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((data: any) => {
        this.nextKeeperOptions = data['keywordList'];
      });
  }

  private notification(message: string, action: string, className: string) {
    this._snackBar.open(message, action, {
      horizontalPosition: "right",
      verticalPosition: "top",
      duration: 10000,
      panelClass: [className]
    });
  }
}
