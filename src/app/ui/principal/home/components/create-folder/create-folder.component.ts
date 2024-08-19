import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Document } from "../../../../../core/models/folder.model";

@Component({
  selector: "app-create-folder",
  templateUrl: "./create-folder.component.html",
  styleUrls: ["./create-folder.component.css"],
})
export class CreateFolderComponent implements OnInit {
  editMode: boolean = false;
  folderName: string = "";
  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<CreateFolderComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { folder: Document }
  ) {}

  ngOnInit(): void {
    if (this.data.folder) {
      this.editMode = true;
      this.folderName = this.data.folder.name;
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  addFolder() {
    if (this.editMode) {
      this.data.folder.name = this.folderName;
      this.dialogRef.close(this.data.folder);
    } else {
      this.dialogRef.close(this.folderName);
    }
  }
}
