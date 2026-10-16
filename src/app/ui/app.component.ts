import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { PrincipalModule } from "./principal/principal.module";
import { ToastContainerComponent } from "./shared/feedback/toast-container.component";
import { ConfirmDialogComponent } from "./shared/feedback/confirm-dialog.component";
import { PwaService } from "../core/services/pwa.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PrincipalModule,
    RouterOutlet,
    ToastContainerComponent,
    ConfirmDialogComponent,
  ],
  providers: [],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  title = "examhub";

  // Se crea al arrancar para no perder el aviso de instalación.
  constructor(_pwa: PwaService) {}
}
