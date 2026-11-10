import { Component } from '@angular/core';
import { ShellComponent } from './core/layout/shell/shell.component';

@Component({
  selector: 'app-root',
  imports: [ShellComponent],
  template: '<app-shell />',
})
export class App {}
