import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-create-folder",
  templateUrl: "./create-folder.component.html",
  styleUrls: ["./create-folder.component.css"],
})
export class CreateFolderComponent {
  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<CreateFolderComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { folderName: string }
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
