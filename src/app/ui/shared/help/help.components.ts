import { Component, ElementRef, Input, ViewChild } from "@angular/core";
import { HelpService, TourId } from "../../../core/services/help.service";
import { SharedModule } from "../shared.module";

/**
 * Botón "?" que lanza el recorrido de la pantalla.
 *   <eh-tour-button tour="catalog" />
 */
@Component({
  selector: "eh-tour-button",
  standalone: true,
  imports: [SharedModule],
  template: `
    <button type="button" class="eh-icon-btn eh-help-btn" (click)="help.start(tour)" [attr.aria-label]="label" [title]="label">
      <app-icon [icon]="'help_outline'" />
    </button>
  `,
})
export class TourButtonComponent {
  @Input({ required: true }) tour!: TourId;
  @Input() label = "Ver cómo funciona esta pantalla";
  constructor(public help: HelpService) {}
}

/**
 * Tip junto a un campo: un (?) pequeño que explica algo puntual.
 *   <eh-tip title="Formas">Texto de ayuda…</eh-tip>
 */
@Component({
  selector: "eh-tip",
  standalone: true,
  imports: [SharedModule],
  template: `
    <button type="button" #btn class="eh-tip" (click)="open($event)" [attr.aria-label]="'Ayuda: ' + title">
      <app-icon [icon]="'help'" />
    </button>
    <span #content class="hidden"><ng-content /></span>
  `,
})
export class TipComponent {
  @Input({ required: true }) title!: string;
  @ViewChild("btn", { static: true }) btn!: ElementRef<HTMLButtonElement>;
  @ViewChild("content", { static: true }) content!: ElementRef<HTMLSpanElement>;
  constructor(private help: HelpService) {}

  open(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.help.tip(this.btn.nativeElement, this.title, this.content.nativeElement.textContent?.trim() ?? "");
  }
}
