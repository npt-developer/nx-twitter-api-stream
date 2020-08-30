import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { applyTransaction } from '@datorama/akita';
import { TweetRule, TweetTag } from '@nartc/client/models';
import { SocketService, TweetTagMapService } from '@nartc/client/services';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { WebFrameworksRulesStore } from './state/web-frameworks-rules/web-frameworks-rules.store';
import { WebFrameworksTweetsStore } from './state/web-frameworks-tweets/web-frameworks-tweets.store';
import { WebFrameworksStore } from './state/web-frameworks/web-frameworks.store';

@Injectable({ providedIn: 'root' })
export class WebFrameworksService {
  private readonly $unsubscribed = new Subject();

  constructor(
    private readonly http: HttpClient,
    private readonly socketService: SocketService,
    private readonly webFrameworksStore: WebFrameworksStore,
    private readonly webFrameworksTweetsStore: WebFrameworksTweetsStore,
    private readonly webFrameworksRulesStore: WebFrameworksRulesStore,
    private readonly tweetTagMapService: TweetTagMapService,
  ) {}

  init() {
    this.socketService.emit('subscribe');
    this.webFrameworksStore.update({ subscribedAt: Date.now() });
    this.listenToTweetStream();
    this.getRules();
  }

  addRules(rules: { value: string; tag: string }[]): void {
    this.http
      .post<{ id: string; value: string; tag: string }[]>(
        'http://localhost:3333/api/rules',
        rules,
      )
      .subscribe((data) => {
        const newRules = data.map((rule) => {
          const tag: TweetTag = JSON.parse(localStorage.getItem(rule.tag));
          this.tweetTagMapService.addTag(tag);
          return {
            id: rule.id,
            query: rule.value,
            ...tag,
          };
        });
        applyTransaction(() => {
          this.webFrameworksRulesStore.update((state) => ({
            rules: [...state.rules, ...newRules],
          }));
          for (const newRule of newRules) {
            this.webFrameworksStore.update({ [newRule.value]: 0 });
          }
        });
      });
  }

  deleteRules(rules: string[]): void {
    this.http.put('http://localhost:3333/api/rules', rules).subscribe(() => {
      const deletedRules = this.webFrameworksRulesStore
        .getValue()
        .rules.filter((rule) => rules.includes(rule.id));
      applyTransaction(() => {
        this.webFrameworksRulesStore.update((state) => ({
          rules: state.rules.filter((rule) => !rules.includes(rule.id)),
        }));
        console.log({ deletedRules });
        for (const rule of deletedRules) {
          localStorage.removeItem(rule.value);
          this.webFrameworksStore.update((state) =>
            Object.entries(state).reduce((updateState, [key]) => {
              if (rule.value === key) {
                delete updateState[rule.value];
              }
              return updateState;
            }, state),
          );
        }
      });
    });
  }

  private getRules() {
    this.http
      .get<{ id: string; value: string; tag: string }[]>(
        'http://localhost:3333/api/rules',
      )
      .subscribe((data) => {
        const defaultTags = ['angular', 'react', 'vue'];
        this.webFrameworksRulesStore.update(() => {
          const defaultRules: (TweetRule & TweetTag)[] = data
            .filter((rule) => defaultTags.includes(rule.tag))
            .map((rule) => ({
              id: rule.id,
              query: rule.value,
              ...this.tweetTagMapService.getTag(rule.tag),
            }));
          const rules: (TweetRule & TweetTag)[] = data
            .filter((rule) => !defaultTags.includes(rule.tag))
            .map((rule) => {
              const storedTag = localStorage.getItem(rule.tag);
              const tag: TweetTag = storedTag
                ? JSON.parse(storedTag)
                : {
                    label: rule.tag,
                    color: '',
                    marker: '',
                    value: rule.tag,
                  };
              this.tweetTagMapService.addTag(tag);
              return {
                id: rule.id,
                query: rule.value,
                ...tag,
              };
            });
          return { rules, defaultRules };
        });
      });
  }

  private listenToTweetStream() {
    this.socketService
      .on('tweetData')
      .pipe(
        tap((tweet) => {
          console.log(tweet);
          applyTransaction(() => {
            this.webFrameworksStore.updateFromTweet(tweet);
            this.webFrameworksTweetsStore.updateFromTweet(tweet);
          });
        }),
        takeUntil(this.$unsubscribed),
      )
      .subscribe();
  }

  unsubscribeStream() {
    this.socketService.emit('unsubscribe');
    this.$unsubscribed.next();
    this.webFrameworksStore.update({ subscribedAt: 0 });
  }
}
