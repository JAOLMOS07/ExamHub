import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { Document } from "../../../../../core/models/folder.model";

@Component({
  selector: "app-item-list-selected",
  templateUrl: "./item-list-selected.component.html",
  styleUrl: "./item-list-selected.component.css",
})
export class ItemListSelectedComponent implements OnChanges {
  ngOnChanges(changes: SimpleChanges): void {
    console.log("cambio");
  }
  showAnswer: boolean = false;
  @Input() question!: Document;
  @Output() deleteEvent = new EventEmitter<Document>();
  onHoldStart(): void {
    this.showAnswer = true;
  }

  onHoldEnd(): void {
    this.showAnswer = false;
  }
  removeQuestion(question: Document) {
    this.deleteEvent.emit(question);
  }
}
