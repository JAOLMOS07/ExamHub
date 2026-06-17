import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { PrincipalModule } from "./principal/principal.module";
import { ToastContainerComponent } from "./shared/feedback/toast-container.component";
import { ConfirmDialogComponent } from "./shared/feedback/confirm-dialog.component";

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
}
