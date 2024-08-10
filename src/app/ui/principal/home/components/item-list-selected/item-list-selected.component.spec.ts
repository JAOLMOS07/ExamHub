import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemListSelectedComponent } from './item-list-selected.component';

describe('ItemListSelectedComponent', () => {
  let component: ItemListSelectedComponent;
  let fixture: ComponentFixture<ItemListSelectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemListSelectedComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ItemListSelectedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
