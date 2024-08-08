import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { PrincipalModule } from "./principal/principal.module";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [PrincipalModule, RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  title = "examhub";
}
