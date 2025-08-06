import { faker } from '@faker-js/faker';

/**
 * Advanced Test Data Factories
 *
 * Provides comprehensive test data generation with realistic, randomized data
 * for thorough testing scenarios.
 */

export interface StudioFactory {
  slug?: string;
  name?: string;
  timezone?: string;
  currency?: string;
}

export interface SlotFactory {
  title?: string;
  startsAt?: string;
  durationMin?: number;
  recurrenceRule?: string;
  price?: number;
  minParticipants?: number;
  maxParticipants?: number;
  forChildren?: boolean;
}

export interface CustomerFactory {
  firstName?: string;
  avatarKey?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface ChildFactory {
  firstName?: string;
  avatarKey?: string;
}

/**
 * Studio Factory - generates realistic studio data
 */
export class Studios {
  static create(overrides: Partial<StudioFactory> = {}): StudioFactory {
    const businessName = faker.company.name();
    const baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 20);

    // Ensure slug is valid (non-empty, valid characters only)
    const validSlug = baseSlug || 'test-studio';

    return {
      slug: `${validSlug}-${faker.string.alphanumeric(8).toLowerCase()}`,
      name: businessName,
      timezone: faker.helpers.arrayElement([
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Asia/Tokyo',
        'Asia/Jerusalem',
        'Australia/Sydney',
      ]),
      currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'ILS', 'JPY']),
      ...overrides,
    };
  }

  static createYogaStudio(
    overrides: Partial<StudioFactory> = {}
  ): StudioFactory {
    return this.create({
      name: `${faker.word.adjective()} Yoga Studio`,
      timezone: 'America/New_York',
      currency: 'USD',
      ...overrides,
    });
  }

  static createDanceStudio(
    overrides: Partial<StudioFactory> = {}
  ): StudioFactory {
    return this.create({
      name: `${faker.word.adjective()} Dance Academy`,
      timezone: 'Europe/London',
      currency: 'GBP',
      ...overrides,
    });
  }

  static createIsraeliStudio(
    overrides: Partial<StudioFactory> = {}
  ): StudioFactory {
    return this.create({
      name: `אולפן ${faker.word.adjective()}`,
      timezone: 'Asia/Jerusalem',
      currency: 'ILS',
      ...overrides,
    });
  }
}

/**
 * Slot Factory - generates realistic class/session data
 */
export class Slots {
  static create(overrides: Partial<SlotFactory> = {}): SlotFactory {
    const startTime = faker.date.future({ years: 0.5 });
    const duration = faker.helpers.arrayElement([30, 45, 60, 75, 90, 120]);

    return {
      title: faker.helpers.arrayElement([
        'Morning Yoga Flow',
        'Advanced Pilates',
        'Beginner Ballet',
        'Hip Hop Dance',
        'Meditation Session',
        'Strength Training',
        'Cardio Blast',
        'Flexibility Class',
      ]),
      startsAt: startTime.toISOString(),
      durationMin: duration,
      price: parseFloat(faker.commerce.price({ min: 15, max: 80, dec: 2 })),
      minParticipants: faker.number.int({ min: 1, max: 3 }),
      maxParticipants: faker.number.int({ min: 8, max: 25 }),
      forChildren: faker.datatype.boolean(),
      ...overrides,
    };
  }

  static createYogaClass(overrides: Partial<SlotFactory> = {}): SlotFactory {
    return this.create({
      title: `${faker.helpers.arrayElement(['Gentle', 'Power', 'Restorative', 'Vinyasa'])} Yoga`,
      durationMin: faker.helpers.arrayElement([60, 75, 90]),
      price: parseFloat(faker.commerce.price({ min: 20, max: 35, dec: 2 })),
      forChildren: false,
      ...overrides,
    });
  }

  static createKidsClass(overrides: Partial<SlotFactory> = {}): SlotFactory {
    return this.create({
      title: `Kids ${faker.helpers.arrayElement(['Dance', 'Gymnastics', 'Art', 'Music', 'Drama'])}`,
      durationMin: faker.helpers.arrayElement([30, 45]),
      price: parseFloat(faker.commerce.price({ min: 12, max: 25, dec: 2 })),
      minParticipants: 3,
      maxParticipants: faker.number.int({ min: 8, max: 15 }),
      forChildren: true,
      ...overrides,
    });
  }

  static createRecurringClass(
    overrides: Partial<SlotFactory> = {}
  ): SlotFactory {
    const recurrenceRules = [
      'FREQ=WEEKLY;BYDAY=MO',
      'FREQ=WEEKLY;BYDAY=WE',
      'FREQ=WEEKLY;BYDAY=FR',
      'FREQ=WEEKLY;BYDAY=SA',
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'FREQ=WEEKLY;BYDAY=TU,TH',
    ];

    return this.create({
      recurrenceRule: faker.helpers.arrayElement(recurrenceRules),
      ...overrides,
    });
  }

  static createFreeClass(overrides: Partial<SlotFactory> = {}): SlotFactory {
    return this.create({
      title: `Free ${faker.helpers.arrayElement(['Trial', 'Community', 'Intro'])} Class`,
      price: 0,
      ...overrides,
    });
  }
}

/**
 * Customer Factory - generates realistic customer data
 */
export class Customers {
  static create(overrides: Partial<CustomerFactory> = {}): CustomerFactory {
    const firstName = faker.person.firstName();

    return {
      firstName,
      contactEmail: faker.internet.email({ firstName }),
      contactPhone: faker.phone.number(),
      avatarKey: `avatar-${faker.string.alphanumeric(10)}`,
      ...overrides,
    };
  }

  static createWithEmail(
    overrides: Partial<CustomerFactory> = {}
  ): CustomerFactory {
    return this.create({
      contactPhone: undefined, // Email only
      ...overrides,
    });
  }

  static createWithPhone(
    overrides: Partial<CustomerFactory> = {}
  ): CustomerFactory {
    return this.create({
      contactEmail: undefined, // Phone only
      ...overrides,
    });
  }

  static createParent(
    overrides: Partial<CustomerFactory> = {}
  ): CustomerFactory {
    return this.create({
      firstName: faker.person.firstName() + ' (Parent)',
      ...overrides,
    });
  }
}

/**
 * Child Factory - generates realistic child data
 */
export class Children {
  static create(overrides: Partial<ChildFactory> = {}): ChildFactory {
    return {
      firstName: faker.person.firstName(),
      avatarKey: `child-avatar-${faker.string.alphanumeric(8)}`,
      ...overrides,
    };
  }

  static createSibling(
    baseName: string,
    overrides: Partial<ChildFactory> = {}
  ): ChildFactory {
    return this.create({
      firstName: `${baseName} ${faker.helpers.arrayElement(['Jr', 'II', 'Little'])}`,
      ...overrides,
    });
  }
}

/**
 * Scenario Factory - creates complete test scenarios
 */
export class Scenarios {
  /**
   * Create a complete family scenario with parent and children
   */
  static createFamily() {
    const parent = Customers.createParent();
    const children = Array.from(
      { length: faker.number.int({ min: 1, max: 3 }) },
      () => Children.create()
    );

    return { parent, children };
  }

  /**
   * Create a typical studio with various class types
   */
  static createStudioWithClasses() {
    const studio = Studios.createYogaStudio();
    const classes = [
      Slots.createYogaClass(),
      Slots.createKidsClass(),
      Slots.createRecurringClass(),
      Slots.createFreeClass(),
    ];

    return { studio, classes };
  }

  /**
   * Create a busy day schedule
   */
  static createBusySchedule(date: Date = new Date()) {
    const slots = [];
    const startHour = 8; // 8 AM
    const endHour = 20; // 8 PM

    for (let hour = startHour; hour < endHour; hour += 2) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);

      slots.push(
        Slots.create({
          startsAt: slotTime.toISOString(),
          durationMin: faker.helpers.arrayElement([60, 90]),
        })
      );
    }

    return slots;
  }
}

/**
 * Preset data for specific test scenarios
 */
export const TestPresets = {
  validStudio: () => Studios.createYogaStudio(),
  validSlot: () => Slots.createYogaClass(),
  validCustomer: () => Customers.create(),
  validChild: () => Children.create(),

  // Common invalid scenarios
  invalidStudio: () => ({
    slug: '', // Invalid empty slug
    name: '',
    timezone: 'Invalid/Timezone',
    currency: 'INVALID',
  }),

  invalidSlot: () => ({
    title: '',
    startsAt: 'invalid-date',
    durationMin: -1,
    price: -10,
    minParticipants: 10,
    maxParticipants: 5, // Min > Max
  }),
};
