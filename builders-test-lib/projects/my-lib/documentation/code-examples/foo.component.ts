import { Component } from "@angular/core";

import { MyLibService } from 'projects/my-lib/src/index';

@Component({
  selector: 'app-foobar',
  template: `<p>foobar works!</p>`
})
export class FoobarComponent {
  constructor(public svc: MyLibService) {}
}
