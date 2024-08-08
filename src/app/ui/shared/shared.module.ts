import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { FtxIconComponent as IconComponent } from "./ftx-icon/ftx-icon.component";
import { MatIconModule } from "@angular/material/icon";
import { NavbarComponent } from "./components/navbar/navbar.component";
import { MatDialogModule } from "@angular/material/dialog";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MatFormFieldModule } from "@angular/material/form-field";

import { MatRadioModule } from "@angular/material/radio";
@NgModule({
  declarations: [IconComponent, NavbarComponent],
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatRadioModule,
  ],
  exports: [
    IconComponent,
    NavbarComponent,
    MatDialogModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatRadioModule,
  ],
  providers: [provideNativeDateAdapter()],
})
export class SharedModule {}
