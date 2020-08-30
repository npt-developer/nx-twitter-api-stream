import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { RouterModule } from '@angular/router';
import { BarChartModule } from '@swimlane/ngx-charts';
import { webFrameworksRoutes } from './web-frameworks.routes';
import { WebFrameworksComponent } from './web-frameworks/web-frameworks.component';
import { ChartComponent } from './components/chart/chart.component';
import { ListComponent } from './components/list/list.component';
import { MapComponent } from './components/map/map.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(webFrameworksRoutes),
    GoogleMapsModule,
    BarChartModule,
  ],
  declarations: [WebFrameworksComponent, ChartComponent, ListComponent, MapComponent],
})
export class ClientCoreWebFrameworksModule {}
