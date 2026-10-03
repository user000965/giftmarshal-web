// Security-rules tests for giftmarshal-pots-demo: the ported production rules plus pots.
// Every block guards a read or query the web client really issues, because a rules
// change that looks right can still deny the exact query the app runs.
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const DANA = 'uid_dana';               // recipient: created the event as 'receiving', owns WL
const P1 = 'uid_p1';                   // participant, starter of POT
const P2 = 'uid_p2';                   // participant, pledged to POT
const GUEST = 'uid_guest';             // anonymous guest who joined with joinEvent
const LINK_HOLDER = 'uid_link_holder'; // anonymous, has only the pot share link

const EVENT = 'event_dana';
const WL = 'wishlist_dana';
const POT = 'pot_open';
const DRAFT = 'pot_draft';
const NO_HIDDEN = 'pot_missing_field';

let testEnv;
const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = (uid) => testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const nobody = () => testEnv.unauthenticatedContext().firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-giftmarshal-rules',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const past = Timestamp.fromMillis(Date.now() - 60_000);
    const future = Timestamp.fromMillis(Date.now() + 7 * 24 * 3_600_000);

    await setDoc(doc(db, 'events', EVENT), {
      id: EVENT, title: "Dana's birthday", eventType: 'birthday', organizerId: DANA, creatorRole: 'receiving',
      isPublic: false, status: 'active', assignmentsGenerated: false, eventCode: 'AB2CD3',
    });
    for (const [uid, role] of [[DANA, 'Organizer'], [P1, 'Participant'], [P2, 'Participant'], [GUEST, 'Participant']]) {
      await setDoc(doc(db, 'events', EVENT, 'participants', uid), { id: uid, role, eventId: EVENT, userName: uid });
    }

    await setDoc(doc(db, 'wishlists', WL), { id: WL, ownerId: DANA, eventIds: [EVENT], isPublic: false, title: 'Birthday list' });
    await setDoc(doc(db, 'wishlists', WL, 'items', 'item_1'), { id: 'item_1', title: 'E-reader', wishlistId: WL });
    await setDoc(doc(db, 'wishlists', WL, 'items', 'item_2'), { id: 'item_2', title: 'Coffee grinder', wishlistId: WL });
    await setDoc(doc(db, 'wishlists', WL, 'claimState', 'item_1'), { itemId: 'item_1', isClaimed: true, isGroupGift: true, contributorCount: 2, potId: POT });
    await setDoc(doc(db, 'wishlists', WL, 'reveals', 'item_1'), { potId: POT, giftTitle: 'E-reader', revealAt: past });
    await setDoc(doc(db, 'wishlists', WL, 'reveals', 'item_2'), { potId: 'pot_later', giftTitle: 'Coffee grinder', revealAt: future });

    await setDoc(doc(db, 'claims', 'claim_pot'), {
      id: 'claim_pot', claimerId: P1, potId: POT, wishlistId: WL, itemId: 'item_1', wishlistOwnerId: DANA, isGroupGift: true, eventId: EVENT,
    });
    await setDoc(doc(db, 'claims', 'claim_plain'), {
      id: 'claim_plain', claimerId: P2, wishlistId: WL, itemId: 'item_2', wishlistOwnerId: DANA, isGroupGift: false, eventId: EVENT,
    });

    const pot = {
      eventId: EVENT, wishlistId: WL, itemId: 'item_1', starterId: P1, hiddenFromUid: DANA,
      targetCents: 24000, heldCents: 8000, capturedCents: 0, contributorNames: ['Marat', 'Aida'],
    };
    await setDoc(doc(db, 'pots', POT), { id: POT, status: 'open', ...pot });
    await setDoc(doc(db, 'pots', DRAFT), { id: DRAFT, status: 'draft', ...pot });
    await setDoc(doc(db, 'pots', NO_HIDDEN), { id: NO_HIDDEN, status: 'open', starterId: P1 });
    await setDoc(doc(db, 'pots', POT, 'pledges', P2), { contributorId: P2, contributorName: 'Aida', amountCents: 4000, status: 'held' });
    await setDoc(doc(db, 'pots', POT, 'pledges', LINK_HOLDER), { contributorId: LINK_HOLDER, contributorName: 'Marat', amountCents: 4000, status: 'held' });
    await setDoc(doc(db, 'pots', POT, 'private', 'payout'), { email: 'starter@example.com', status: 'not_requested' });
    await setDoc(doc(db, 'paypalEvents', 'WH-1'), { type: 'PAYMENT.CAPTURE.COMPLETED' });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

describe('ported production rules', () => {
  test('a participant can list claim state for a wishlist in their event', async () => {
    await assertSucceeds(getDocs(collection(as(P1), 'wishlists', WL, 'claimState')));
  });

  test('an anonymous guest who joined can read claim state (joinEvent keys participants by uid)', async () => {
    await assertSucceeds(getDocs(collection(anon(GUEST), 'wishlists', WL, 'claimState')));
  });

  test('the wishlist owner can NEVER read claim state on their own list', async () => {
    await assertFails(getDocs(collection(as(DANA), 'wishlists', WL, 'claimState')));
    await assertFails(getDoc(doc(as(DANA), 'wishlists', WL, 'claimState', 'item_1')));
  });

  test('a participant can read a private event wishlist by id and list its items', async () => {
    await assertSucceeds(getDoc(doc(as(P1), 'wishlists', WL)));
    await assertSucceeds(getDocs(collection(as(P1), 'wishlists', WL, 'items')));
  });

  // PROBE (roadmap item 5). The wishlist read rule calls exists() on paths built from
  // resource.data.eventIds, which lesson #3 says a list cannot evaluate. If this assertion
  // FAILS (meaning the query is allowed), delete this test and record in the roadmap that
  // Plan 4 can list event wishlists directly instead of adding listEventWishlists.
  test('PROBE: a participant cannot list private event wishlists with array-contains', async () => {
    await assertFails(getDocs(query(collection(as(P1), 'wishlists'), where('eventIds', 'array-contains', EVENT))));
  });

  test('"my events" works as a collection-group query on my own participant records', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as(P1), 'participants'), where('id', '==', P1))));
  });

  test('CHANGED: events cannot be listed (this project has no legacy client)', async () => {
    await assertFails(getDocs(collection(as(P1), 'events')));
  });

  test('a known event id can be read, even anonymously', async () => {
    await assertSucceeds(getDoc(doc(anon(LINK_HOLDER), 'events', EVENT)));
  });

  test('an anonymous session cannot create an event', async () => {
    await assertFails(setDoc(doc(anon(LINK_HOLDER), 'events', 'ev_anon'), { id: 'ev_anon', title: 'x', organizerId: LINK_HOLDER }));
  });

  test('a real user can create an event and bootstrap their organizer record', async () => {
    const db = as('uid_new');
    await assertSucceeds(setDoc(doc(db, 'events', 'ev_new'), {
      id: 'ev_new', title: 'New', eventType: 'general', organizerId: 'uid_new', isPublic: false, assignmentsGenerated: false, eventCode: '',
    }));
    await assertSucceeds(setDoc(doc(db, 'events', 'ev_new', 'participants', 'uid_new'), { id: 'uid_new', role: 'Organizer', eventId: 'ev_new' }));
  });

  test('a claimer can list only their own claims', async () => {
    await assertSucceeds(getDocs(query(collection(as(P1), 'claims'), where('claimerId', '==', P1))));
    await assertFails(getDocs(collection(as(P1), 'claims')));
  });

  test('a claimer can delete a plain claim (unclaim)', async () => {
    await assertSucceeds(deleteDoc(doc(as(P2), 'claims', 'claim_plain')));
  });

  test('CHANGED: a pot-owned claim cannot be deleted by its claimer', async () => {
    await assertFails(deleteDoc(doc(as(P1), 'claims', 'claim_pot')));
  });

  test('clients cannot write locks, claim state, event codes or rate limits', async () => {
    const db = as(P1);
    await assertFails(setDoc(doc(db, 'claimLocks', `${WL}_item_2`), { isGroupGift: false }));
    await assertFails(setDoc(doc(db, 'wishlists', WL, 'claimState', 'item_2'), { isClaimed: true }));
    await assertFails(setDoc(doc(db, 'eventCodes', 'ZZZZZZ'), { eventId: EVENT }));
    await assertFails(setDoc(doc(db, 'rateLimits', 'x'), { count: 0 }));
  });
});

describe('pots', () => {
  test('anyone signed in with the link can read an open pot, including anonymously', async () => {
    await assertSucceeds(getDoc(doc(anon(LINK_HOLDER), 'pots', POT)));
  });

  test('the protected recipient can never read the pot', async () => {
    await assertFails(getDoc(doc(as(DANA), 'pots', POT)));
  });

  test('signed-out visitors cannot read pots', async () => {
    await assertFails(getDoc(doc(nobody(), 'pots', POT)));
  });

  test('a draft is visible to its starter only', async () => {
    await assertSucceeds(getDoc(doc(as(P1), 'pots', DRAFT)));
    await assertFails(getDoc(doc(as(P2), 'pots', DRAFT)));
  });

  test('a pot missing hiddenFromUid is denied to everyone (lesson #2 guard)', async () => {
    await assertFails(getDoc(doc(as(P1), 'pots', NO_HIDDEN)));
  });

  test('the starter can list their pots with the dashboard query', async () => {
    await assertSucceeds(getDocs(query(collection(as(P1), 'pots'), where('starterId', '==', P1))));
  });

  test('no other pot list is allowed', async () => {
    await assertFails(getDocs(collection(as(P1), 'pots')));
    await assertFails(getDocs(query(collection(as(P2), 'pots'), where('eventId', '==', EVENT))));
    await assertFails(getDocs(query(collection(as(P2), 'pots'), where('starterId', '==', P1))));
  });

  test('clients cannot write pots', async () => {
    await assertFails(setDoc(doc(as(P1), 'pots', 'pot_new'), { status: 'open', starterId: P1, hiddenFromUid: DANA }));
    await assertFails(updateDoc(doc(as(P1), 'pots', POT), { heldCents: 24000 }));
  });
});

describe('pledges', () => {
  test('a contributor can read their own pledge', async () => {
    await assertSucceeds(getDoc(doc(as(P2), 'pots', POT, 'pledges', P2)));
  });

  test('a contributor cannot read someone else\'s pledge (amounts stay private)', async () => {
    await assertFails(getDoc(doc(as(P2), 'pots', POT, 'pledges', LINK_HOLDER)));
  });

  test('the starter can list every pledge; contributors cannot', async () => {
    await assertSucceeds(getDocs(collection(as(P1), 'pots', POT, 'pledges')));
    await assertFails(getDocs(collection(as(P2), 'pots', POT, 'pledges')));
  });

  test('the recipient cannot read any pledge', async () => {
    await assertFails(getDoc(doc(as(DANA), 'pots', POT, 'pledges', P2)));
  });

  test('clients cannot write pledges', async () => {
    await assertFails(setDoc(doc(as(P2), 'pots', POT, 'pledges', P2), { amountCents: 1 }));
  });
});

describe('pot private documents', () => {
  test('only the starter can read them', async () => {
    await assertSucceeds(getDoc(doc(as(P1), 'pots', POT, 'private', 'payout')));
    await assertFails(getDoc(doc(as(P2), 'pots', POT, 'private', 'payout')));
    await assertFails(getDoc(doc(as(DANA), 'pots', POT, 'private', 'payout')));
  });

  test('nobody can write them', async () => {
    await assertFails(setDoc(doc(as(P1), 'pots', POT, 'private', 'payout'), { email: 'evil@example.com' }));
  });
});

describe('reveals', () => {
  test('the recipient sees a reveal once revealAt has passed, and not before', async () => {
    await assertSucceeds(getDoc(doc(as(DANA), 'wishlists', WL, 'reveals', 'item_1')));
    await assertFails(getDoc(doc(as(DANA), 'wishlists', WL, 'reveals', 'item_2')));
  });

  test('nobody else can read a reveal', async () => {
    await assertFails(getDoc(doc(as(P1), 'wishlists', WL, 'reveals', 'item_1')));
  });

  test('reveals cannot be listed or written', async () => {
    await assertFails(getDocs(collection(as(DANA), 'wishlists', WL, 'reveals')));
    await assertFails(setDoc(doc(as(DANA), 'wishlists', WL, 'reveals', 'item_2'), { revealAt: Timestamp.now() }));
  });
});

describe('webhook ledger', () => {
  test('is closed to every client', async () => {
    await assertFails(getDoc(doc(as(P1), 'paypalEvents', 'WH-1')));
  });
});
