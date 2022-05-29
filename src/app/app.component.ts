import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormControl} from '@angular/forms';
import {getClient} from "@tauri-apps/api/http";
import {interval, Subscription} from "rxjs";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy{
  range = this.formBuilder.group({
    dateFrom: [''],
    dateTo: ['']
  });
  title = 'notify-me-passport-ro';
  //TODO The id for Dolj is hardcoded for now
  cityID = 67
  subscription?: Subscription

  minDate: Date

  constructor(private formBuilder: FormBuilder) {
    this.minDate = new Date()
  }

  async checkAvailability(): Promise<void> {
    // console.log(typeof this.range.get('dateFrom')?.value)
    // console.log(this.range.get('dateTo')?.value)
    // One of the dates was not yet set
    if (this.range.get('dateFrom')?.value == '' || this.range.get('dateTo')?.value == '') {
      console.dir('No date selected!')
      return
    }
    const dateFrom = Date.parse(this.range.get('dateFrom')?.value)
    const dateTo   = Date.parse(this.range.get('dateTo')?.value)


    // No city was set through the GUI
    if (this.cityID == -1) {
      return
    }

    const client = await getClient().catch(error => {
      console.error(error)
      throw error
    })

    client.get(`https://www.epasapoarte.ro/api/gaps/${this.cityID}`).then(response => {
      const data = response.data as any[]
      data.map(month => {
        for (let day of month) {
          for (let timeslot of day) {
            const parsedDate = Date.parse(timeslot.dt)

            // There is a slot in one of the days we have selected
            if (dateFrom <= parsedDate && parsedDate <= dateTo) {
              this.sendNotification(new Date(Date.parse(timeslot.startTime)))
              return
            }

          }
        }
      })

    })

    // const client = new Client(1)
    // client.get(`https://www.epasapoarte.ro/api/gaps/${cityID}`).then(response => {
    //   console.dir(response.data)
    // })
  }

  sendNotification(startTime: Date) {
    new Notification(`Am gasit o posibila rezervare: ${startTime.toLocaleString('ro-RO', {dateStyle: 'full', timeStyle: 'short'})}`, {body: 'Du-te pe https://www.epasapoarte.ro/ sa rezervi!'})
  }

  async start() {
    await this.checkAvailability()
    const source = interval(1800000 );
    this.subscription = source.subscribe(_ => this.checkAvailability())
  }

  ngOnDestroy(): void {
    this.subscription && this.subscription.unsubscribe()
  }
}
