import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {getClient} from "@tauri-apps/api/http";
import {interval, Observable, Subscription, map, startWith} from "rxjs";
import CountiesJSON from 'src/assets/json/counties.json'

interface TimeInterval {
  value: string
  viewValue: string
}

interface County {
  id: number
  name: string
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy{
  formGroup = this.formBuilder.group({
    county: ['', [Validators.required]],
    timeInterval: ['30'],
    dateFrom: ['', [Validators.required]],
    dateTo: ['', Validators.required]
  });
  title = 'notify-me-passport-ro';

  subscription?: Subscription

  minDate: Date

  allowedTimeIntervals: TimeInterval[] = [
    {value: '5',  viewValue: '5' },
    {value: '10', viewValue: '10'},
    {value: '15', viewValue: '15'},
    {value: '20', viewValue: '20'},
    {value: '30', viewValue: '30'},
    {value: '60', viewValue: '60'}
  ]
  counties: County[] = JSON.parse(JSON.stringify(CountiesJSON))
  filteredOptions?: Observable<County[]>;

  constructor(private formBuilder: FormBuilder) {
    this.minDate = new Date()
  }

  ngOnInit() {
    this.filteredOptions = this.formGroup.get('county')!.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    )
  }
  ngOnDestroy(): void {
    this.subscription && this.subscription.unsubscribe()
  }

  private _filter(value: string): County[] {
    const filterValue = value.toLowerCase();

    return this.counties.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  async checkAvailability(): Promise<void> {
    const dateFrom = Date.parse(this.formGroup.get('dateFrom')?.value)
    const dateTo   = Date.parse(this.formGroup.get('dateTo')?.value)

    const county: string   = this.formGroup.get('county')!.value
    const countyID = this.counties.find(el => el.name == county)!.id

    const client = await getClient().catch(error => {
      console.error(error)
      throw error
    })
    let found = false;

    client.get(`https://www.epasapoarte.ro/api/gaps/${countyID}`).then(response => {
      const data = response.data as any[]
      // TODO Maybe check the order of the months?
      data.map(month => {
        for (let day of month) {
          for (let timeslot of day) {
            const parsedDate = Date.parse(timeslot.dt)

            // There is a slot in one of the days we have selected
            if (dateFrom <= parsedDate && parsedDate <= dateTo) {
              this.sendNotification(new Date(Date.parse(timeslot.startTime)))
              found = true
              return
            }

          }
        }
      })
      if (!found) {
        const timeInterval = this.formGroup.get('timeInterval')?.value
        new Notification('Nu am gasit nicio rezervare 😞',
          {body: `Voi incerca din nou in: ${timeInterval} ${timeInterval < 20 ? 'minute' : 'de minute'}`})
      }

    })

  }

  sendNotification(startTime: Date): void {
    const localizedString = startTime.toLocaleString('ro-RO', {dateStyle: 'full', timeStyle: 'short'})
    new Notification(`Am gasit o posibila rezervare: ${localizedString}`,
      {body: 'Du-te pe https://www.epasapoarte.ro/ sa rezervi!'})
  }

  transformMinutesToMilliseconds(minutes: number) {
    return minutes * 60 * 1000
  }

  async start(): Promise<void> {
    await this.checkAvailability()
    console.log(this.formGroup.get('county')?.value)
    const source = interval(this.transformMinutesToMilliseconds(this.formGroup.get('timeInterval')?.value));
    this.subscription = source.subscribe(_ => this.checkAvailability())
  }

}
