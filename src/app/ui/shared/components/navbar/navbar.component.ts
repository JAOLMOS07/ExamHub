import { Component } from "@angular/core";
import { UserService } from "../../../../core/services/UserService.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.css",
})
export class NavbarComponent {
  constructor(private userService: UserService, private router: Router) {}

  logout() {
    this.userService
      .logout()
      .then(() => {
        console.log("Logout successful");
        this.router.navigate(["/login"]);
      })
      .catch((error) => {
        console.error("Login error:", error);
      });
  }
}
