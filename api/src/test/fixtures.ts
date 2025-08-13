import { createTestStudio, createTestSlot, createTestCustomer } from './test-helpers';
import { Studios, Slots, Customers, Scenarios } from './factories';
import type { TestStudio, TestCustomer, TestChild, TestSlot, Booking } from '../types';

/**
 * Test Fixtures - Pre-built test scenarios for complex testing
 *
 * These fixtures create complete, realistic test environments
 * that can be used across multiple tests.
 */

export interface StudioFixture {
  studio: TestStudio;
  adults: TestSlot[];
  children: TestSlot[];
  slots: TestSlot[];
  customers: TestCustomer[];
}

export interface BookingFixture {
  studio: TestStudio;
  customer: TestCustomer;
  slot: TestSlot;
  booking: Booking;
}

/**
 * Creates a fully populated studio with classes and customers
 */
export async function createCompleteStudio(): Promise<StudioFixture> {
  // Create the studio
  const studioData = Studios.createYogaStudio();
  const studio = await createTestStudio(studioData);

  // Create various types of slots
  const adultSlots = [
    await createTestSlot(studio.id, Slots.createYogaClass()),
    await createTestSlot(studio.id, Slots.createRecurringClass()),
    await createTestSlot(studio.id, Slots.createFreeClass()),
  ];

  const childrenSlots = [
    await createTestSlot(studio.id, Slots.createKidsClass()),
    await createTestSlot(studio.id, Slots.createKidsClass({ title: 'Kids Art Class' })),
  ];

  // Create customers
  const customers = [
    await createTestCustomer(studio.id, Customers.createWithEmail() as any),
    await createTestCustomer(studio.id, Customers.createWithPhone() as any),
    await createTestCustomer(studio.id, Customers.createParent() as any),
  ];

  return {
    studio,
    adults: adultSlots,
    children: childrenSlots,
    slots: [...adultSlots, ...childrenSlots],
    customers,
  };
}

/**
 * Creates a busy studio with many overlapping classes
 */
export async function createBusyStudio(): Promise<StudioFixture> {
  const studioData = Studios.createDanceStudio();
  const studio = await createTestStudio(studioData);

  // Create a busy schedule
  const busySlots = Scenarios.createBusySchedule();
  const slots = [];

  for (const slotData of busySlots) {
    slots.push(await createTestSlot(studio.id, slotData));
  }

  // Create many customers
  const customers = [];
  for (let i = 0; i < 10; i++) {
    customers.push(await createTestCustomer(studio.id, Customers.create() as any));
  }

  return {
    studio,
    adults: slots.filter((s) => !s.for_children),
    children: slots.filter((s) => s.for_children),
    slots,
    customers,
  };
}

/**
 * Creates a family-oriented studio scenario
 */
export async function createFamilyStudio(): Promise<
  StudioFixture & {
    families: Array<{ customer: TestCustomer; children: TestChild[] }>;
  }
> {
  const studioData = Studios.create({
    name: 'Family Fitness Center',
    timezone: 'America/New_York',
    currency: 'USD',
  });
  const studio = await createTestStudio(studioData);

  // Create family-friendly slots
  const familySlots = [
    await createTestSlot(studio.id, Slots.createKidsClass()),
    await createTestSlot(studio.id, Slots.createKidsClass({ title: 'Tiny Tots Dance' })),
    await createTestSlot(studio.id, Slots.createYogaClass({ title: 'Parent & Child Yoga' })),
    await createTestSlot(studio.id, Slots.create({ title: 'Family Fitness', forChildren: false })),
  ];

  // Create families
  const families = [];
  for (let i = 0; i < 3; i++) {
    const family = Scenarios.createFamily();
    const parent = await createTestCustomer(studio.id, family.parent as any);

    families.push({
      parent,
      children: family.children, // Note: children would need to be created after bookings
    });
  }

  return {
    studio,
    adults: familySlots.filter((s) => !s.for_children),
    children: familySlots.filter((s) => s.for_children),
    slots: familySlots,
    customers: families.map((f) => f.parent),
    families: families.map((f) => ({
      customer: f.parent,
      children: f.children as any,
    })),
  };
}

/**
 * Creates edge case scenarios for testing validation
 */
export async function createEdgeCaseStudio(): Promise<StudioFixture> {
  const studioData = Studios.create({
    name: 'Edge Case Studio',
    timezone: 'UTC',
    currency: 'USD',
  });
  const studio = await createTestStudio(studioData);

  // Create edge case slots
  const edgeSlots = [
    // Free class
    await createTestSlot(
      studio.id,
      Slots.create({
        title: 'Free Trial Class',
        price: 0,
        minParticipants: 0,
        maxParticipants: 1,
      }),
    ),

    // Very long class
    await createTestSlot(
      studio.id,
      Slots.create({
        title: 'Marathon Meditation',
        durationMin: 480, // 8 hours
        price: 200,
      }),
    ),

    // Very short class
    await createTestSlot(
      studio.id,
      Slots.create({
        title: 'Quick Stretch',
        durationMin: 15,
        price: 5,
      }),
    ),

    // High capacity class
    await createTestSlot(
      studio.id,
      Slots.create({
        title: 'Mass Yoga Event',
        minParticipants: 50,
        maxParticipants: 500,
        price: 10,
      }),
    ),
  ];

  // Create edge case customers
  const edgeCustomers = [
    // Customer with very long name
    await createTestCustomer(
      studio.id,
      Customers.create({
        firstName: 'Pneumonoultramicroscopicsilicovolcanoconiosisaffectedperson',
      }) as any,
    ),

    // Customer with minimal data
    await createTestCustomer(
      studio.id,
      Customers.create({
        firstName: 'A',
        contactEmail: 'a@b.co',
      }) as any,
    ),
  ];

  return {
    studio,
    adults: edgeSlots.filter((s) => !s.for_children),
    children: edgeSlots.filter((s) => s.for_children),
    slots: edgeSlots,
    customers: edgeCustomers,
  };
}

/**
 * Creates international studio scenarios for globalization testing
 */
export async function createInternationalStudios(): Promise<StudioFixture[]> {
  const scenarios = [
    // Israeli studio
    {
      studioData: Studios.createIsraeliStudio(),
      slots: [Slots.create({ title: 'יוגה בוקר' }), Slots.create({ title: 'פילאטיס ערב' })],
    },

    // Japanese studio
    {
      studioData: Studios.create({
        name: '東京ヨガスタジオ',
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
      }),
      slots: [
        Slots.create({ title: '朝ヨガ', price: 3000 }),
        Slots.create({ title: 'キッズダンス', forChildren: true, price: 2000 }),
      ],
    },

    // European studio
    {
      studioData: Studios.create({
        name: 'Académie de Danse Parisienne',
        timezone: 'Europe/Paris',
        currency: 'EUR',
      }),
      slots: [
        Slots.create({ title: 'Ballet Classique', price: 45 }),
        Slots.create({ title: 'Danse Contemporaine', price: 50 }),
      ],
    },
  ];

  const studios = [];

  for (const scenario of scenarios) {
    const studio = await createTestStudio(scenario.studioData);
    const slots = [];

    for (const slotData of scenario.slots) {
      slots.push(await createTestSlot(studio.id, slotData));
    }

    const customers = [
      await createTestCustomer(studio.id, Customers.create() as any),
      await createTestCustomer(studio.id, Customers.create() as any),
    ];

    studios.push({
      studio,
      adults: slots.filter((s) => !s.for_children),
      children: slots.filter((s) => s.for_children),
      slots,
      customers,
    });
  }

  return studios;
}
