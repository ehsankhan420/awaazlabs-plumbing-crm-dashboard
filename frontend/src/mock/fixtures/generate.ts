/**
 * FIXTURE GENERATOR — deterministic construction of a complete plumbing OrgFixture.
 *
 * Everything is anchored to MOCK_NOW_UTC and a seeded PRNG, so every count, aging badge,
 * and chart bucket is stable and reproducible. Hand-authored "hero" records (live calls,
 * the exhausted dispatch, the overdue critical escalation, authored transcripts) sit on
 * top of the generated base so every spec demo state actually renders.
 */

import type {
  AgentRegistryEntry,
  CallInteraction,
  Campaign,
  CampaignContact,
  ChatInteraction,
  ChatMessage,
  CustomerContact,
  CustomerNotification,
  DispatchRecord,
  Escalation,
  FlaggedInteraction,
  Job,
  JobTimelineEvent,
  KnowledgeBlock,
  KnowledgeChangeRequest,
  LiveCallNow,
  Member,
  MockOrganization,
  OptimizationEvent,
  OrgFixture,
  OutreachAttempt,
  PhoneLine,
  Plumber,
  PrivateFeedback,
  PublishedReview,
  ReviewRequest,
  SuppressionEntry,
  TranscriptTurn,
} from '@/mock/schema';
import type {
  AssignmentStatus,
  CallDisposition,
  CampaignContactStatus,
  ChatChannel,
  ChatOutcome,
  EscalationSeverity,
  EscalationTrigger,
  IntakeChannel,
  IssueType,
  JobPriority,
  JobStatus,
  Language,
  OutreachOutcome,
  Specialty,
} from '@/shared/status-models';
import { ISSUE_TYPE_LABELS } from '@/shared/status-models';
import {
  addMinutes,
  addSeconds,
  atLocalHour,
  daysAgo,
  hoursAgo,
  makeGrade,
  makePrng,
  minutesAgo,
  pad,
  turn,
  type Prng,
} from './helpers';

/* ==================================================================================
 * Pools
 * ================================================================================== */

const FIRST_NAMES = [
  'Maria', 'James', 'Priya', 'Robert', 'Elena', 'David', 'Aisha', 'Michael', 'Sofia', 'Daniel',
  'Grace', 'Carlos', 'Nina', 'Thomas', 'Layla', 'Kevin', 'Rosa', 'Brian', 'Amara', 'Steven',
  'Diane', 'Hector', 'Wendy', 'Omar', 'Janet', 'Felix', 'Tara', 'Victor', 'Holly', 'Marcus',
] as const;

const LAST_NAMES = [
  'Alvarez', 'Chen', 'Patel', 'Brooks', 'Kowalski', 'Nguyen', 'Rahman', 'OConnor', 'Rossi', 'Kim',
  'Thompson', 'Mendoza', 'Novak', 'Wright', 'Haddad', 'Larson', 'Delgado', 'Foster', 'Okafor', 'Price',
  'Whitman', 'Serrano', 'Boyd', 'Farah', 'Meyer', 'Vance', 'Ellison', 'Cruz', 'Sutton', 'Bishop',
] as const;

const STREETS = [
  'Maple Ave', 'Oakwood Dr', 'Ridgeline Rd', 'Sycamore St', 'Willow Ct', 'Prairie Ln',
  'Harbor Blvd', 'Cedarcrest Way', 'Foxglove Ter', 'Birchwood Pl', 'Elm St', 'Granite Dr',
] as const;

const PLUMBER_NAMES = [
  'Mike Torres', 'Sandra Lee', 'Ray Okafor', 'Tony Marino', 'Jess Weaver', 'Sam Whitfield',
  'Derek Hall', 'Luis Herrera', 'Kat Brennan', 'Andre Sims', 'Paula Reyes', 'Chris Dooley',
] as const;

/** IssueType → the specialty a qualified plumber needs. */
const ISSUE_SPECIALTY: Readonly<Record<IssueType, Specialty>> = {
  leaking_pipe: 'leak_detection',
  clogged_drain: 'drain_cleaning',
  water_heater_failure: 'water_heater',
  burst_pipe: 'general_repair',
  running_toilet: 'general_repair',
  low_water_pressure: 'general_repair',
  sewer_backup: 'sewer_main',
  gas_leak_suspected: 'gas_line',
  fixture_installation: 'fixture_install',
  sump_pump_failure: 'general_repair',
};

/** IssueType → a short jobType work description. */
const ISSUE_JOB_TYPES: Readonly<Record<IssueType, readonly string[]>> = {
  leaking_pipe: ['Pipe leak repair', 'Under-sink leak repair'],
  clogged_drain: ['Drain clearing', 'Main drain snake'],
  water_heater_failure: ['Water heater repair', 'Water heater replacement'],
  burst_pipe: ['Emergency pipe repair'],
  running_toilet: ['Toilet repair', 'Toilet rebuild'],
  low_water_pressure: ['Pressure diagnosis', 'Pressure regulator replacement'],
  sewer_backup: ['Sewer line clearing', 'Sewer camera inspection'],
  gas_leak_suspected: ['Gas line inspection'],
  fixture_installation: ['Faucet installation', 'Dishwasher hookup', 'Shower valve install'],
  sump_pump_failure: ['Sump pump replacement', 'Sump pump repair'],
};

const CUSTOMER_DESCRIPTIONS: Readonly<Record<IssueType, string>> = {
  leaking_pipe: 'There is water dripping from the pipe under the kitchen sink and the cabinet floor is soaked.',
  clogged_drain: 'The shower drain is completely backed up and water is standing in the tub.',
  water_heater_failure: 'No hot water since last night. The tank is making a rumbling noise.',
  burst_pipe: 'A pipe burst in the basement and water is spraying everywhere. Main shutoff is closed.',
  running_toilet: 'The upstairs toilet keeps running all night and the handle feels loose.',
  low_water_pressure: 'Water pressure dropped in the whole house, worst in the master bathroom.',
  sewer_backup: 'Sewage is coming up through the basement floor drain when we run the washer.',
  gas_leak_suspected: 'We smell gas near the water heater closet. We opened the windows.',
  fixture_installation: 'Bought a new kitchen faucet and need it installed, old one is corroded.',
  sump_pump_failure: 'Sump pump stopped running and rain is forecast this weekend.',
};

const CHAT_INTENTS = [
  'Clogged drain — schedule service',
  'Water heater quote request',
  'Job status question',
  'Reschedule existing job',
  'Service area question',
  'Pricing question',
  'New job intake',
] as const;

const LIVE_STAGES = [
  'Capturing service address',
  'Confirming issue details',
  'Offering service window',
  'Reading back job summary',
] as const;

/* ==================================================================================
 * Small helpers
 * ================================================================================== */

function isoDayOffset(iso: string): number {
  // Whole days between the timestamp and MOCK_NOW (UTC-day granularity is fine for fixtures).
  return Math.floor((new Date('2026-07-09T15:20:00.000Z').getTime() - new Date(iso).getTime()) / 86_400_000);
}

interface NameId {
  first: string;
  last: string;
}

function pickName(rng: Prng, used: Set<string>): NameId {
  for (let i = 0; i < 20; i += 1) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const key = `${first} ${last}`;
    if (!used.has(key)) {
      used.add(key);
      return { first, last };
    }
  }
  const first = rng.pick(FIRST_NAMES);
  const last = `${rng.pick(LAST_NAMES)}-${rng.int(2, 9)}`;
  return { first, last };
}

/* ==================================================================================
 * Config
 * ================================================================================== */

export interface GenerateConfig {
  readonly org: MockOrganization;
  readonly seed: number;
  /** Short org tag used in ids, e.g. "br". */
  readonly tag: string;
  /** Approximate jobs per weekday. */
  readonly jobsPerDay: number;
  /** Days of history to generate. */
  readonly historyDays: number;
  readonly plumberCount: number;
  readonly members: readonly Member[];
  /** One line per entry; `healthy: false` entries feed the attention banner. */
  readonly lines: readonly PhoneLine[];
  readonly invoices: readonly Invoice[];
  readonly minutesConsumed: number;
  readonly chatSessionsConsumed: number;
  readonly liveCallCount: number;
}

type Invoice = OrgFixture['invoices'][number];

/* ==================================================================================
 * Authored transcripts
 * ================================================================================== */

function intakeTranscript(customer: string, address: string, at: string): readonly TranscriptTurn[] {
  const t = (s: number) => addSeconds(at, s);
  return [
    turn('agent', t(0), 'Thanks for calling — this is the automated assistant. How can I help you today?'),
    turn('caller', t(6), `Hi, this is ${customer}. Our water heater stopped working last night and there's no hot water.`),
    turn('agent', t(14), 'I can help with that. Can I confirm the service address?'),
    turn('caller', t(20), `It's ${address}.`, [{ phrase: address, kind: 'address' }]),
    turn('agent', t(27), 'Got it. Is there any water leaking from the tank, or any smell of gas?'),
    turn('caller', t(34), 'No leaks and no gas smell. It just will not heat.'),
    turn('agent', t(41), 'Understood. The earliest preferred window I can request is tomorrow morning, eight to eleven. Does that work?'),
    turn('caller', t(50), 'Yes, morning works.'),
    turn('agent', t(55), 'I have created your job and a technician assignment will be confirmed shortly. You will get a text confirmation now.'),
  ];
}

function dispatchAcceptTranscript(plumber: string, jobType: string, area: string, at: string): readonly TranscriptTurn[] {
  const t = (s: number) => addSeconds(at, s);
  return [
    turn('agent', t(0), `Hi ${plumber}, this is the BlueRidge dispatch assistant with a job offer.`),
    turn('caller', t(5), 'Go ahead.'),
    turn('agent', t(9), `${jobType} in ${area}, requested window tomorrow eight to eleven. Can you take it?`),
    turn('caller', t(18), 'Yes, I can take that one.'),
    turn('agent', t(22), 'Great — you are confirmed. Job details and the customer contact are in your text message.'),
  ];
}

function dispatchDeclineTranscript(plumber: string, jobType: string, at: string): readonly TranscriptTurn[] {
  const t = (s: number) => addSeconds(at, s);
  return [
    turn('agent', t(0), `Hi ${plumber}, this is the dispatch assistant with a job offer.`),
    turn('caller', t(5), 'Listening.'),
    turn('agent', t(8), `${jobType}, requested for this afternoon. Are you available?`),
    turn('caller', t(15), 'No, I am tied up on a repipe until Friday. Pass this one.'),
    turn('agent', t(20), 'Understood, I will offer it to the next qualified plumber. Thanks.'),
  ];
}

function emergencyTranscript(customer: string, at: string): readonly TranscriptTurn[] {
  const t = (s: number) => addSeconds(at, s);
  return [
    turn('agent', t(0), 'Thanks for calling — this is the automated assistant. How can I help you today?'),
    turn('caller', t(5), `This is ${customer} — we smell gas near the water heater. It's strong.`),
    turn('agent', t(12), 'That is an emergency. Please leave the building now, do not switch lights on or off, and call your gas utility from outside.'),
    turn('caller', t(22), 'Okay, we are heading out now.'),
    turn('agent', t(26), 'I am transferring you to our on-call staff immediately and flagging this as an emergency.'),
  ];
}

/* ==================================================================================
 * The generator
 * ================================================================================== */

export function generateOrgFixture(config: GenerateConfig): OrgFixture {
  const { org, tag } = config;
  const rng = makePrng(config.seed);
  const usedNames = new Set<string>();
  const areaIds = org.serviceAreas.map((a) => a.id);
  const locIds = org.locations.map((l) => l.id);
  const tz = org.locations[0].timezone;

  /* ---------------- plumbers ---------------- */

  const plumbers: Plumber[] = [];
  for (let i = 0; i < config.plumberCount; i += 1) {
    const specialties: Specialty[] = [ISSUE_SPECIALTY[rng.pick(Object.keys(ISSUE_SPECIALTY) as IssueType[])]];
    if (!specialties.includes('general_repair') && rng.chance(0.7)) specialties.push('general_repair');
    if (rng.chance(0.4)) {
      const extra = ISSUE_SPECIALTY[rng.pick(Object.keys(ISSUE_SPECIALTY) as IssueType[])];
      if (!specialties.includes(extra)) specialties.push(extra);
    }
    const areas = areaIds.filter(() => rng.chance(0.6));
    if (areas.length === 0) areas.push(rng.pick(areaIds));
    plumbers.push({
      id: `plb_${tag}_${pad(i + 1, 2)}`,
      name: PLUMBER_NAMES[i % PLUMBER_NAMES.length],
      phoneE164: `+1312556${pad(2000 + i, 4)}`,
      specialties,
      serviceAreaIds: areas,
      availability: rng.chance(0.55) ? 'available' : rng.chance(0.6) ? 'on_job' : 'off_shift',
      activeJobs: rng.int(0, 3),
      acceptanceRate: rng.int(48, 92) / 100,
      lastContactedUtc: rng.chance(0.8) ? hoursAgo(rng.int(1, 96)) : null,
    });
  }

  const plumbersFor = (specialty: Specialty, areaId: string): Plumber[] =>
    plumbers.filter((p) => p.specialties.includes(specialty) && p.serviceAreaIds.includes(areaId));

  /* ---------------- base records, accumulated ---------------- */

  const contacts: CustomerContact[] = [];
  const jobs: Job[] = [];
  const dispatchRecords: DispatchRecord[] = [];
  const calls: CallInteraction[] = [];
  const chats: ChatInteraction[] = [];
  const escalations: Escalation[] = [];
  const reviewRequests: ReviewRequest[] = [];

  let contactSeq = 0;
  let jobSeq = 0;
  let callSeq = 0;
  let escSeq = 0;

  function makeContact(locationId: string, language: Language): CustomerContact {
    contactSeq += 1;
    const name = pickName(rng, usedNames);
    const areaId = rng.pick(areaIds);
    const area = org.serviceAreas.find((a) => a.id === areaId)!;
    const contact: CustomerContact = {
      id: `cus_${tag}_${pad(contactSeq)}`,
      identity: {
        firstName: name.first,
        lastName: name.last,
        phoneE164: `+1312555${pad(1000 + ((config.seed + contactSeq * 37) % 9000), 4)}`,
      },
      serviceAddress: `${rng.int(100, 9800)} ${rng.pick(STREETS)}`,
      zip: rng.pick(area.zips),
      serviceAreaId: areaId,
      language,
      locationId,
      consentBasis: 'Service request',
      suppressed: false,
    };
    contacts.push(contact);
    return contact;
  }

  interface JobSeed {
    createdAt: string;
    intakeChannel: IntakeChannel;
    priority: JobPriority;
    status: JobStatus;
    issueType: IssueType;
  }

  function jobStatusForAge(ageDays: number, priority: JobPriority): JobStatus {
    if (ageDays >= 3) {
      if (rng.chance(0.85)) return 'completed';
      if (rng.chance(0.55)) return 'canceled';
      return rng.chance(0.5) ? 'completed' : 'scheduled';
    }
    if (ageDays >= 1) {
      const roll = rng.next();
      if (roll < 0.45) return 'completed';
      if (roll < 0.6) return 'scheduled';
      if (roll < 0.72) return 'assigned';
      if (roll < 0.82) return 'in_progress';
      if (roll < 0.9) return 'dispatching';
      return rng.chance(0.5) ? 'canceled' : 'en_route';
    }
    // Today: full mix of early-lifecycle states.
    const roll = rng.next();
    if (priority === 'emergency') return roll < 0.5 ? 'dispatching' : 'assigned';
    if (roll < 0.12) return 'new';
    if (roll < 0.3) return 'ready_for_dispatch';
    if (roll < 0.5) return 'dispatching';
    if (roll < 0.68) return 'assigned';
    if (roll < 0.84) return 'scheduled';
    if (roll < 0.92) return 'en_route';
    return 'completed';
  }

  const JOB_ACTOR = 'AI Receptionist';

  function buildJob(seed: JobSeed): Job {
    jobSeq += 1;
    const locationId = rng.pick(locIds);
    const language: Language = rng.chance(0.85) ? 'en' : rng.chance(0.8) ? 'es' : 'other';
    const contact = makeContact(locationId, language);
    const issue = seed.issueType;
    const specialty = ISSUE_SPECIALTY[issue];
    const jobType = rng.pick(ISSUE_JOB_TYPES[issue]);
    const createdBy = seed.intakeChannel === 'voice' ? 'ai_receptionist' : seed.intakeChannel === 'staff_entry' ? 'staff' : 'chat_agent';
    const status = seed.status;
    const id = `job_${tag}_${pad(jobSeq)}`;
    const reference = `JOB-${1000 + jobSeq}`;

    const wentThroughDispatch = !['new', 'ready_for_dispatch', 'canceled'].includes(status) || (status === 'canceled' && rng.chance(0.4));
    const requestedStart = addMinutes(seed.createdAt, rng.int(3 * 60, 48 * 60));
    const requestedWindow = { startUtc: requestedStart, endUtc: addMinutes(requestedStart, 180) };
    const hasSchedule = ['scheduled', 'en_route', 'in_progress', 'completed'].includes(status);
    const scheduledStart = status === 'scheduled'
      ? atLocalHour(-rng.int(0, 6), rng.int(8, 15), tz)
      : addMinutes(requestedStart, rng.int(-60, 60));
    const scheduledWindow = hasSchedule ? { startUtc: scheduledStart, endUtc: addMinutes(scheduledStart, 120) } : null;

    const timeline: JobTimelineEvent[] = [{ at: seed.createdAt, label: 'Job created', actor: JOB_ACTOR }];
    const notifications: CustomerNotification[] = [
      { at: addMinutes(seed.createdAt, 1), kind: 'job_created_confirmation', channel: 'sms', deliveryStatus: 'sent' },
    ];

    let dispatchId: string | null = null;
    let assignedPlumberId: string | null = null;

    if (wentThroughDispatch) {
      const readyAt = addMinutes(seed.createdAt, rng.int(2, 25));
      timeline.push({ at: readyAt, label: 'Ready for Dispatch', actor: 'System' });
      const dispatchStart = addMinutes(readyAt, rng.int(1, 10));

      const assignmentStatus: AssignmentStatus =
        status === 'dispatching'
          ? rng.pick(['matching', 'contacting', 'awaiting_response'] as const)
          : status === 'ready_for_dispatch' || status === 'new'
            ? 'unassigned'
            : status === 'canceled'
              ? 'unassigned'
              : rng.chance(0.12)
                ? 'manually_assigned'
                : 'accepted';

      const eligible = plumbersFor(specialty, contact.serviceAreaId);
      const eligibleIds = (eligible.length > 0 ? eligible : plumbers.slice(0, 3)).map((p) => p.id);

      const attempts: OutreachAttempt[] = [];
      const attemptCount =
        assignmentStatus === 'accepted' ? rng.int(1, 3)
        : assignmentStatus === 'awaiting_response' || assignmentStatus === 'contacting' ? rng.int(1, 2)
        : 0;

      let acceptedAt: string | null = null;
      for (let a = 0; a < attemptCount; a += 1) {
        const isLast = a === attemptCount - 1;
        const plumberId = eligibleIds[a % eligibleIds.length];
        const at = addMinutes(dispatchStart, a * rng.int(8, 20));
        const outcome: OutreachOutcome =
          assignmentStatus === 'accepted' && isLast
            ? 'accepted'
            : assignmentStatus === 'awaiting_response' && isLast
              ? 'voicemail'
              : rng.pick(['declined', 'no_answer', 'voicemail', 'unavailable'] as const);
        const duration = outcome === 'no_answer' ? null : rng.int(25, 140);
        attempts.push({ attemptNumber: a + 1, plumberId, at, outcome, callDurationSeconds: duration, interactionId: null });
        if (outcome === 'accepted') acceptedAt = addSeconds(at, duration ?? 60);
      }

      if (assignmentStatus === 'manually_assigned') acceptedAt = addMinutes(dispatchStart, rng.int(10, 45));
      if (assignmentStatus === 'accepted' || assignmentStatus === 'manually_assigned') {
        assignedPlumberId = attempts.find((a) => a.outcome === 'accepted')?.plumberId ?? rng.pick(eligibleIds);
      }

      const statusTimeline: { at: string; status: AssignmentStatus; actor: string }[] = [
        { at: dispatchStart, status: 'matching', actor: 'Plumber Dispatch Agent' },
      ];
      if (attempts.length > 0) statusTimeline.push({ at: attempts[0].at, status: 'contacting', actor: 'Plumber Dispatch Agent' });
      if (acceptedAt) {
        statusTimeline.push({ at: acceptedAt, status: assignmentStatus === 'manually_assigned' ? 'manually_assigned' : 'accepted', actor: assignmentStatus === 'manually_assigned' ? 'Dispatcher' : 'Plumber Dispatch Agent' });
      } else if (assignmentStatus === 'awaiting_response' && attempts.length > 0) {
        statusTimeline.push({ at: attempts[attempts.length - 1].at, status: 'awaiting_response', actor: 'Plumber Dispatch Agent' });
      }

      dispatchId = `disp_${tag}_${pad(jobSeq)}`;
      dispatchRecords.push({
        id: dispatchId,
        jobId: id,
        status: assignmentStatus,
        requiredSpecialty: specialty,
        serviceAreaId: contact.serviceAreaId,
        zip: contact.zip,
        locationId,
        currentCandidateId:
          assignmentStatus === 'contacting' || assignmentStatus === 'awaiting_response'
            ? eligibleIds[attempts.length % eligibleIds.length]
            : null,
        assignedPlumberId,
        startedAtUtc: dispatchStart,
        acceptedAtUtc: acceptedAt,
        scheduledWindow,
        attempts,
        eligiblePlumberIds: eligibleIds,
        statusTimeline,
        notes: [],
        escalationId: null,
      });

      timeline.push({ at: dispatchStart, label: 'Dispatch started', actor: 'Plumber Dispatch Agent' });
      if (acceptedAt && assignedPlumberId) {
        const plumberName = plumbers.find((p) => p.id === assignedPlumberId)?.name ?? 'Plumber';
        timeline.push({ at: acceptedAt, label: `Plumber assigned — ${plumberName}`, actor: assignmentStatus === 'manually_assigned' ? 'Dispatcher' : 'Plumber Dispatch Agent' });
        notifications.push({ at: addMinutes(acceptedAt, 2), kind: 'assignment_confirmation', channel: 'sms', deliveryStatus: 'sent' });
      }
      if (scheduledWindow && hasSchedule) {
        timeline.push({ at: addMinutes(acceptedAt ?? dispatchStart, 10), label: 'Scheduled', actor: 'System' });
        notifications.push({ at: addMinutes(acceptedAt ?? dispatchStart, 12), kind: 'arrival_window_notification', channel: 'sms', deliveryStatus: rng.chance(0.96) ? 'sent' : 'failed' });
      }
    }

    if (['en_route', 'in_progress', 'completed'].includes(status) && scheduledWindow) {
      timeline.push({ at: addMinutes(scheduledWindow.startUtc, -30), label: 'En Route', actor: assignedPlumberId ? plumbers.find((p) => p.id === assignedPlumberId)?.name ?? 'Plumber' : 'Plumber' });
    }
    if (['in_progress', 'completed'].includes(status) && scheduledWindow) {
      timeline.push({ at: scheduledWindow.startUtc, label: 'In Progress', actor: 'Plumber' });
    }
    if (status === 'completed' && scheduledWindow) {
      timeline.push({ at: addMinutes(scheduledWindow.startUtc, rng.int(45, 170)), label: 'Completed', actor: 'Plumber' });
    }
    if (status === 'canceled') {
      timeline.push({ at: addMinutes(seed.createdAt, rng.int(30, 600)), label: 'Canceled', actor: rng.chance(0.7) ? 'Customer' : 'Staff' });
      notifications.push({ at: addMinutes(seed.createdAt, rng.int(30, 600)), kind: 'cancellation_notice', channel: 'sms', deliveryStatus: 'sent' });
    }

    const job: Job = {
      id,
      reference,
      contactId: contact.id,
      status,
      priority: seed.priority,
      issueType: issue,
      jobType,
      customerDescription: CUSTOMER_DESCRIPTIONS[issue],
      requestedWindow,
      scheduledWindow: status === 'scheduled' || ['en_route', 'in_progress', 'completed'].includes(status) ? scheduledWindow : null,
      intakeChannel: seed.intakeChannel,
      language,
      createdBy,
      createdByAgent: createdBy === 'ai_receptionist' ? 'receptionist' : createdBy === 'chat_agent' ? 'chat' : null,
      createdAtUtc: seed.createdAt,
      locationId,
      serviceAreaId: contact.serviceAreaId,
      dispatchId,
      requiredSpecialty: specialty,
      assignedPlumberId,
      originatingInteractionId: null,
      timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)),
      notifications,
      staffNotes: rng.chance(0.15)
        ? [{ at: addMinutes(seed.createdAt, 90), author: 'Dana (Dispatcher)', body: 'Customer prefers a call 30 minutes before arrival.' }]
        : [],
    };
    jobs.push(job);
    return job;
  }

  /* ---------------- job history ---------------- */

  const channelRoll = (): IntakeChannel => {
    const r = rng.next();
    if (r < 0.55) return 'voice';
    if (r < 0.7) return 'web_chat';
    if (r < 0.82) return 'sms';
    if (r < 0.92) return 'whatsapp';
    return 'staff_entry';
  };

  const priorityRoll = (): JobPriority => {
    const r = rng.next();
    if (r < 0.82) return 'routine';
    if (r < 0.96) return 'urgent';
    return 'emergency';
  };

  const issueRoll = (): IssueType => rng.pick(Object.keys(ISSUE_SPECIALTY) as IssueType[]);

  for (let day = config.historyDays; day >= 0; day -= 1) {
    const weekday = new Date(daysAgo(day)).getUTCDay();
    const base = weekday === 0 ? Math.max(1, Math.round(config.jobsPerDay * 0.3)) : config.jobsPerDay;
    const count = Math.max(1, base + rng.int(-2, 2));
    for (let j = 0; j < count; j += 1) {
      const priority = priorityRoll();
      const hour = rng.int(7, 18);
      const createdAt = day === 0 ? minutesAgo(rng.int(10, 7 * 60)) : atLocalHour(-day + 0, hour, tz, rng.int(0, 59));
      // atLocalHour dayOffset: negative = past. `-day` days ago.
      const at = day === 0 ? createdAt : atLocalHour(-day, hour, tz, rng.int(0, 59));
      const status = jobStatusForAge(day, priority);
      buildJob({ createdAt: at, intakeChannel: channelRoll(), priority, status, issueType: issueRoll() });
    }
  }

  /* ---------------- hero records ---------------- */

  // Hero 1: exhausted dispatch + linked overdue urgent escalation (attention banner).
  const heroExhaustedJob = buildJob({
    createdAt: hoursAgo(5),
    intakeChannel: 'voice',
    priority: 'urgent',
    status: 'dispatching',
    issueType: 'sewer_backup',
  });
  {
    const rec = dispatchRecords.find((d) => d.jobId === heroExhaustedJob.id);
    const contact = contacts.find((c) => c.id === heroExhaustedJob.contactId)!;
    escSeq += 1;
    const escId = `esc_${tag}_${pad(escSeq)}`;
    const attempts: OutreachAttempt[] = [0, 1, 2].map((a) => ({
      attemptNumber: a + 1,
      plumberId: plumbers[a % plumbers.length].id,
      at: hoursAgo(4.4 - a),
      outcome: (['no_answer', 'declined', 'voicemail'] as const)[a],
      callDurationSeconds: a === 1 ? 48 : null,
      interactionId: null,
    }));
    const exhausted: DispatchRecord = {
      ...(rec ?? {
        id: `disp_${tag}_hx`,
        jobId: heroExhaustedJob.id,
        requiredSpecialty: 'sewer_main',
        serviceAreaId: contact.serviceAreaId,
        zip: contact.zip,
        locationId: heroExhaustedJob.locationId,
        scheduledWindow: null,
        notes: [],
        eligiblePlumberIds: plumbers.slice(0, 3).map((p) => p.id),
      } as unknown as DispatchRecord),
      status: 'exhausted',
      currentCandidateId: null,
      assignedPlumberId: null,
      startedAtUtc: hoursAgo(4.5),
      acceptedAtUtc: null,
      attempts,
      statusTimeline: [
        { at: hoursAgo(4.5), status: 'matching', actor: 'Plumber Dispatch Agent' },
        { at: hoursAgo(4.4), status: 'contacting', actor: 'Plumber Dispatch Agent' },
        { at: hoursAgo(2.2), status: 'exhausted', actor: 'Plumber Dispatch Agent' },
      ],
      escalationId: escId,
    };
    if (rec) dispatchRecords[dispatchRecords.indexOf(rec)] = exhausted;
    else dispatchRecords.push(exhausted);

    escalations.push({
      id: escId,
      reference: `ESC-${100 + escSeq}`,
      atUtc: hoursAgo(2.2),
      contactId: contact.id,
      jobId: heroExhaustedJob.id,
      dispatchId: exhausted.id,
      sourceInteractionId: null,
      trigger: 'dispatch_exhausted',
      severity: 'urgent',
      reason: 'All three eligible sewer-main plumbers declined or did not answer within the attempt window.',
      owner: null,
      status: 'open',
      acknowledgedAtUtc: null,
      acknowledgedBy: null,
      resolutionNote: null,
      resolvedAtUtc: null,
      locationId: heroExhaustedJob.locationId,
    });
  }

  // Hero 2: emergency call + critical open escalation past its 15-minute threshold.
  const heroEmergencyContact = makeContact(locIds[0], 'en');
  {
    callSeq += 1;
    const at = minutesAgo(42);
    const callId = `call_${tag}_${pad(callSeq, 4)}`;
    const custName = `${heroEmergencyContact.identity!.firstName} ${heroEmergencyContact.identity!.lastName}`;
    escSeq += 1;
    const escId = `esc_${tag}_${pad(escSeq)}`;
    calls.push({
      id: callId,
      kind: 'call',
      atUtc: at,
      direction: 'inbound',
      agent: 'receptionist',
      partyType: 'customer',
      contactId: heroEmergencyContact.id,
      plumberId: null,
      durationSeconds: 96,
      disposition: 'emergency_escalation',
      priority: 'emergency',
      grade: makeGrade(93, rng),
      locationId: heroEmergencyContact.locationId,
      media: {
        recordingUrl: `/recordings/${callId}.mp3`,
        transcript: emergencyTranscript(custName, at),
        consentDisclosureAtUtc: at,
      },
      firstAudioResponseMs: 610,
      costUsd: 0.34,
      extracted: {
        issueType: 'gas_leak_suspected',
        jobType: 'Gas line inspection',
        requiredSpecialty: 'gas_line',
        preferredWindowLabel: 'Immediate',
        plumberResponse: null,
      },
      linked: { jobId: null, dispatchId: null, escalationId: escId, reviewRequestId: null, campaignId: null },
    });
    escalations.push({
      id: escId,
      reference: `ESC-${100 + escSeq}`,
      atUtc: minutesAgo(40),
      contactId: heroEmergencyContact.id,
      jobId: null,
      dispatchId: null,
      sourceInteractionId: callId,
      trigger: 'emergency_condition',
      severity: 'critical',
      reason: 'Customer reports a strong gas smell near the water heater. Advised evacuation; needs immediate human follow-up.',
      owner: null,
      status: 'open',
      acknowledgedAtUtc: null,
      acknowledgedBy: null,
      resolutionNote: null,
      resolvedAtUtc: null,
      locationId: heroEmergencyContact.locationId,
    });
  }

  /* ---------------- calls derived from jobs & dispatch ---------------- */

  const heroAuthoredIntake = { used: false };

  for (const job of jobs) {
    const contact = contacts.find((c) => c.id === job.contactId)!;
    const custName = contact.identity ? `${contact.identity.firstName} ${contact.identity.lastName}` : 'the customer';

    if (job.intakeChannel === 'voice') {
      callSeq += 1;
      const callId = `call_${tag}_${pad(callSeq, 4)}`;
      const duration = rng.int(120, 420);
      const authored = !heroAuthoredIntake.used && job.issueType === 'water_heater_failure' && isoDayOffset(job.createdAtUtc) <= 2;
      if (authored) heroAuthoredIntake.used = true;
      const withMedia = authored || rng.chance(0.55);
      calls.push({
        id: callId,
        kind: 'call',
        atUtc: addMinutes(job.createdAtUtc, -Math.round(duration / 60)),
        direction: 'inbound',
        agent: 'receptionist',
        partyType: 'customer',
        contactId: contact.id,
        plumberId: null,
        durationSeconds: duration,
        disposition: 'job_created',
        priority: job.priority,
        grade: makeGrade(rng.int(78, 97), rng),
        locationId: job.locationId,
        media: withMedia
          ? {
              recordingUrl: `/recordings/${callId}.mp3`,
              transcript: authored
                ? intakeTranscript(custName, contact.serviceAddress, addMinutes(job.createdAtUtc, -Math.round(duration / 60)))
                : [
                    turn('agent', addMinutes(job.createdAtUtc, -5), 'Thanks for calling — how can I help you today?'),
                    turn('caller', addMinutes(job.createdAtUtc, -4), CUSTOMER_DESCRIPTIONS[job.issueType]),
                    turn('agent', addMinutes(job.createdAtUtc, -3), 'I can get a job set up for that. Let me confirm your address and a preferred window.'),
                    turn('caller', addMinutes(job.createdAtUtc, -2), 'Sounds good.'),
                  ],
              consentDisclosureAtUtc:
                org.locations.find((l) => l.id === job.locationId)?.recordingConsentMode === 'two_party'
                  ? addMinutes(job.createdAtUtc, -5)
                  : null,
            }
          : null,
        firstAudioResponseMs: rng.int(480, 1150),
        costUsd: Math.round(duration * 0.09) / 60 + 0.1,
        extracted: {
          issueType: job.issueType,
          jobType: job.jobType,
          requiredSpecialty: job.requiredSpecialty,
          preferredWindowLabel: 'Next available morning',
          plumberResponse: null,
        },
        linked: { jobId: job.id, dispatchId: job.dispatchId, escalationId: null, reviewRequestId: null, campaignId: null },
      });
      // Point the job back at its originating call.
      const idx = jobs.indexOf(job);
      jobs[idx] = { ...job, originatingInteractionId: callId };
    }
  }

  // Outbound dispatch calls: one per outreach attempt with a duration.
  let heroDeclineUsed = false;
  let heroAcceptUsed = false;
  for (const rec of dispatchRecords) {
    const job = jobs.find((j) => j.id === rec.jobId);
    if (!job) continue;
    const updatedAttempts: OutreachAttempt[] = [];
    for (const attempt of rec.attempts) {
      const plumber = plumbers.find((p) => p.id === attempt.plumberId);
      if (!plumber || attempt.callDurationSeconds === null) {
        updatedAttempts.push(attempt);
        continue;
      }
      callSeq += 1;
      const callId = `call_${tag}_${pad(callSeq, 4)}`;
      const authoredAccept = !heroAcceptUsed && attempt.outcome === 'accepted';
      const authoredDecline = !heroDeclineUsed && attempt.outcome === 'declined';
      if (authoredAccept) heroAcceptUsed = true;
      if (authoredDecline) heroDeclineUsed = true;
      const areaName = org.serviceAreas.find((a) => a.id === rec.serviceAreaId)?.name ?? 'the area';
      const withMedia = authoredAccept || authoredDecline || rng.chance(0.4);
      calls.push({
        id: callId,
        kind: 'call',
        atUtc: attempt.at,
        direction: 'outbound',
        agent: 'dispatch',
        partyType: 'plumber',
        contactId: null,
        plumberId: plumber.id,
        durationSeconds: attempt.callDurationSeconds,
        disposition: attempt.outcome === 'voicemail' ? 'voicemail' : 'information_provided',
        priority: job.priority,
        grade: makeGrade(rng.int(80, 96), rng),
        locationId: rec.locationId,
        media: withMedia
          ? {
              recordingUrl: `/recordings/${callId}.mp3`,
              transcript: authoredAccept
                ? dispatchAcceptTranscript(plumber.name, job.jobType, areaName, attempt.at)
                : authoredDecline
                  ? dispatchDeclineTranscript(plumber.name, job.jobType, attempt.at)
                  : [
                      turn('agent', attempt.at, `Hi ${plumber.name}, this is the dispatch assistant with a job offer: ${job.jobType}.`),
                      turn('caller', addSeconds(attempt.at, 8), attempt.outcome === 'accepted' ? 'I can take it.' : 'Not available for that one.'),
                    ],
              consentDisclosureAtUtc: null,
            }
          : null,
        firstAudioResponseMs: rng.int(420, 900),
        costUsd: Math.round(attempt.callDurationSeconds * 0.09) / 60 + 0.08,
        extracted: {
          issueType: job.issueType,
          jobType: job.jobType,
          requiredSpecialty: rec.requiredSpecialty,
          preferredWindowLabel: null,
          plumberResponse: attempt.outcome,
        },
        linked: { jobId: job.id, dispatchId: rec.id, escalationId: rec.escalationId, reviewRequestId: null, campaignId: null },
      });
      updatedAttempts.push({ ...attempt, interactionId: callId });
    }
    dispatchRecords[dispatchRecords.indexOf(rec)] = { ...rec, attempts: updatedAttempts };
  }

  // A scattering of non-job calls: info-only, out-of-area, missed.
  const miscDispositions: readonly CallDisposition[] = [
    'information_provided', 'information_provided', 'out_of_service_area', 'duplicate_request',
    'voicemail', 'no_answer', 'abandoned', 'human_transfer',
  ];
  const miscCount = Math.round(jobs.length * 0.45);
  for (let i = 0; i < miscCount; i += 1) {
    callSeq += 1;
    const callId = `call_${tag}_${pad(callSeq, 4)}`;
    const disposition = rng.pick(miscDispositions);
    const withContact = rng.chance(0.6);
    const contact = withContact ? makeContact(rng.pick(locIds), rng.chance(0.85) ? 'en' : 'es') : null;
    const dayOff = rng.int(0, config.historyDays);
    const at = dayOff === 0 ? minutesAgo(rng.int(15, 8 * 60)) : atLocalHour(-dayOff, rng.int(7, 19), tz, rng.int(0, 59));
    const answered = !['voicemail', 'no_answer', 'abandoned'].includes(disposition);
    const duration = answered ? rng.int(45, 300) : rng.int(0, 40);
    calls.push({
      id: callId,
      kind: 'call',
      atUtc: at,
      direction: 'inbound',
      agent: 'receptionist',
      partyType: 'customer',
      contactId: contact?.id ?? null,
      plumberId: null,
      durationSeconds: duration,
      disposition,
      priority: 'routine',
      grade: answered ? makeGrade(rng.int(74, 95), rng) : null,
      locationId: contact?.locationId ?? rng.pick(locIds),
      media: null,
      firstAudioResponseMs: rng.int(480, 1300),
      costUsd: Math.round(duration * 0.09) / 60 + 0.05,
      extracted: null,
      linked: { jobId: null, dispatchId: null, escalationId: null, reviewRequestId: null, campaignId: null },
    });
  }

  /* ---------------- follow-up / review / reengagement calls ---------------- */

  const completedJobs = jobs.filter((j) => j.status === 'completed');
  let reviewSeq = 0;
  for (const job of completedJobs) {
    if (!rng.chance(0.65)) continue;
    reviewSeq += 1;
    const contact = contacts.find((c) => c.id === job.contactId)!;
    const funnel = rng.next();
    const status =
      funnel < 0.1 ? 'eligible'
      : funnel < 0.2 ? 'contacted'
      : funnel < 0.32 ? 'reached'
      : funnel < 0.45 ? 'ask_delivered'
      : funnel < 0.62 ? 'link_sent'
      : funnel < 0.86 ? 'review_posted'
      : funnel < 0.95 ? 'declined'
      : 'opted_out';
    const completedAt = job.timeline.find((t) => t.label === 'Completed')?.at ?? job.createdAtUtc;
    const calledAt = status === 'eligible' ? null : addMinutes(completedAt, rng.int(60, 26 * 60));
    let interactionId: string | null = null;
    if (calledAt) {
      callSeq += 1;
      interactionId = `call_${tag}_${pad(callSeq, 4)}`;
      calls.push({
        id: interactionId,
        kind: 'call',
        atUtc: calledAt,
        direction: 'outbound',
        agent: 'review_taker',
        partyType: 'customer',
        contactId: contact.id,
        plumberId: null,
        durationSeconds: rng.int(40, 160),
        disposition: 'information_provided',
        priority: 'routine',
        grade: makeGrade(rng.int(80, 97), rng),
        locationId: job.locationId,
        media: null,
        firstAudioResponseMs: rng.int(450, 900),
        costUsd: 0.18,
        extracted: null,
        linked: { jobId: job.id, dispatchId: null, escalationId: null, reviewRequestId: `rev_${tag}_${pad(reviewSeq)}`, campaignId: null },
      });
    }
    reviewRequests.push({
      id: `rev_${tag}_${pad(reviewSeq)}`,
      contactId: contact.id,
      jobId: job.id,
      status,
      calledAtUtc: calledAt,
      callDurationSeconds: calledAt ? rng.int(40, 160) : null,
      linkClicked: ['link_sent', 'review_posted'].includes(status) ? rng.chance(0.8) : false,
      postedRating: status === 'review_posted' ? (rng.chance(0.78) ? 5 : 4) : null,
      postedAtUtc: status === 'review_posted' && calledAt ? addMinutes(calledAt, rng.int(60, 48 * 60)) : null,
      locationId: job.locationId,
      interactionId,
    });
  }

  // Post-service follow-up calls (custom agent) on a slice of completed jobs.
  for (const job of completedJobs) {
    if (!rng.chance(0.3)) continue;
    callSeq += 1;
    const completedAt = job.timeline.find((t) => t.label === 'Completed')?.at ?? job.createdAtUtc;
    calls.push({
      id: `call_${tag}_${pad(callSeq, 4)}`,
      kind: 'call',
      atUtc: addMinutes(completedAt, rng.int(20 * 60, 3 * 24 * 60)),
      direction: 'outbound',
      agent: 'post_service_followup',
      partyType: 'customer',
      contactId: job.contactId,
      plumberId: null,
      durationSeconds: rng.int(45, 180),
      disposition: rng.chance(0.85) ? 'information_provided' : 'voicemail',
      priority: 'routine',
      grade: makeGrade(rng.int(82, 97), rng),
      locationId: job.locationId,
      media: null,
      firstAudioResponseMs: rng.int(450, 900),
      costUsd: 0.16,
      extracted: null,
      linked: { jobId: job.id, dispatchId: null, escalationId: null, reviewRequestId: null, campaignId: null },
    });
  }

  /* ---------------- chats ---------------- */

  const chatCount = Math.round(jobs.length * 0.5);
  const chatJobPool = jobs.filter((j) => j.intakeChannel !== 'voice' && j.intakeChannel !== 'staff_entry');
  for (let i = 0; i < chatCount; i += 1) {
    const linkedJob = i < chatJobPool.length ? chatJobPool[i] : null;
    const channel: ChatChannel = linkedJob
      ? (linkedJob.intakeChannel as ChatChannel)
      : rng.pick(['web_chat', 'sms', 'whatsapp'] as const);
    const outcome: ChatOutcome = linkedJob
      ? 'job_created'
      : rng.chance(0.6) ? 'resolved' : rng.chance(0.5) ? 'escalated' : 'abandoned';
    const contact = linkedJob ? contacts.find((c) => c.id === linkedJob.contactId)! : rng.chance(0.7) ? makeContact(rng.pick(locIds), 'en') : null;
    const dayOff = linkedJob ? isoDayOffset(linkedJob.createdAtUtc) : rng.int(0, config.historyDays);
    const at = linkedJob
      ? addMinutes(linkedJob.createdAtUtc, -rng.int(6, 20))
      : dayOff === 0 ? minutesAgo(rng.int(20, 9 * 60)) : atLocalHour(-dayOff, rng.int(7, 20), tz, rng.int(0, 59));
    const messageCount = rng.int(4, 18);
    const handoff = outcome === 'escalated';
    const custFirst = contact?.identity?.firstName ?? 'Visitor';
    const messages: ChatMessage[] = [
      { at, speaker: 'customer', text: linkedJob ? CUSTOMER_DESCRIPTIONS[linkedJob.issueType] : 'Hi, I have a question about service.', isHandoffMarker: false },
      { at: addSeconds(at, 5), speaker: 'agent', text: `Hi ${custFirst}! I can help with that. Could you share your ZIP code so I can check coverage?`, isHandoffMarker: false },
      { at: addSeconds(at, 40), speaker: 'customer', text: contact ? contact.zip : '60601', isHandoffMarker: false },
      {
        at: addSeconds(at, 48),
        speaker: 'agent',
        text: linkedJob
          ? 'You are in our service area. I have what I need — creating your job now and texting you the confirmation.'
          : outcome === 'resolved'
            ? 'You are in our service area. Our standard dispatch fee is $89, waived if you proceed with the repair.'
            : 'Let me connect you with a member of our team for that.',
        isHandoffMarker: false,
      },
    ];
    if (handoff) {
      messages.push({ at: addSeconds(at, 70), speaker: 'human_staff', text: 'Hi, this is Dana from BlueRidge — taking over from the assistant.', isHandoffMarker: true });
    }
    chats.push({
      id: `chat_${tag}_${pad(i + 1, 4)}`,
      kind: 'chat',
      atUtc: at,
      channel,
      contactId: contact?.id ?? null,
      lastMessageAtUtc: addMinutes(at, rng.int(2, 25)),
      outcome,
      messageCount,
      intent: linkedJob ? `${ISSUE_TYPE_LABELS[linkedJob.issueType]} — new job` : rng.pick(CHAT_INTENTS),
      language: contact?.language ?? 'en',
      locationId: contact?.locationId ?? rng.pick(locIds),
      responseLatencyMs: rng.int(400, 2200),
      grade: rng.chance(0.7) ? makeGrade(rng.int(76, 96), rng) : null,
      humanHandoff: handoff,
      linked: { jobId: linkedJob?.id ?? null, escalationId: null },
      messages,
    });
  }

  /* ---------------- additional escalations ---------------- */

  const escalationSeeds: readonly { trigger: EscalationTrigger; severity: EscalationSeverity; reason: string }[] = [
    { trigger: 'customer_requested_human', severity: 'attention', reason: 'Customer asked to speak with a person about invoice details.' },
    { trigger: 'customer_requested_human', severity: 'attention', reason: 'Customer wants to discuss a multi-unit property contract.' },
    { trigger: 'safety_risk', severity: 'critical', reason: 'Standing water near an electrical panel reported in the basement.' },
    { trigger: 'out_of_service_area', severity: 'attention', reason: 'Request from a ZIP outside all configured service areas.' },
    { trigger: 'no_suitable_plumber', severity: 'urgent', reason: 'No gas-line certified plumber covers the requested area this week.' },
    { trigger: 'agent_failure', severity: 'urgent', reason: 'Intake call dropped twice before the address was captured.' },
    { trigger: 'customer_requested_human', severity: 'attention', reason: 'Customer disputes the quoted dispatch fee.' },
    { trigger: 'emergency_condition', severity: 'critical', reason: 'Burst pipe flooding a ground-floor unit; customer shut the main.' },
  ];
  const escCountTarget = Math.max(6, Math.round(jobs.length * 0.08));
  for (let i = 0; i < escCountTarget; i += 1) {
    const seed = escalationSeeds[i % escalationSeeds.length];
    escSeq += 1;
    const dayOff = rng.int(0, Math.min(20, config.historyDays));
    const at = dayOff === 0 ? minutesAgo(rng.int(30, 10 * 60)) : atLocalHour(-dayOff, rng.int(7, 19), tz, rng.int(0, 59));
    const resolved = dayOff > 1 || rng.chance(0.5);
    const acknowledged = resolved || rng.chance(0.6);
    const contact = rng.chance(0.8) ? makeContact(rng.pick(locIds), 'en') : null;
    const ackMinutes = seed.severity === 'critical' ? rng.int(4, 14) : seed.severity === 'urgent' ? rng.int(8, 28) : rng.int(20, 200);
    const owner = acknowledged ? rng.pick(config.members.filter((m) => m.role !== 'VIEWER')).name : null;
    escalations.push({
      id: `esc_${tag}_${pad(escSeq)}`,
      reference: `ESC-${100 + escSeq}`,
      atUtc: at,
      contactId: contact?.id ?? null,
      jobId: null,
      dispatchId: null,
      sourceInteractionId: rng.chance(0.7) && calls.length > 0 ? rng.pick(calls).id : null,
      trigger: seed.trigger,
      severity: seed.severity,
      reason: seed.reason,
      owner,
      status: resolved ? 'resolved' : acknowledged ? 'acknowledged' : 'open',
      acknowledgedAtUtc: acknowledged ? addMinutes(at, ackMinutes) : null,
      acknowledgedBy: owner,
      resolutionNote: resolved ? 'Handled by phone; customer confirmed resolution.' : null,
      resolvedAtUtc: resolved ? addMinutes(at, ackMinutes + rng.int(20, 240)) : null,
      locationId: contact?.locationId ?? rng.pick(locIds),
    });
  }

  /* ---------------- quality ---------------- */

  const optimizationEvents: OptimizationEvent[] = [
    {
      id: `opt_${tag}_1`,
      detectedAtUtc: daysAgo(24),
      agent: 'receptionist',
      status: 'verified',
      whatWasDetected: 'Callers describing water heater issues were asked to repeat the tank size twice.',
      whatWasChanged: 'Intake flow now confirms tank details once and moves straight to the service window.',
      gradeDelta: 4,
      deployedAtUtc: daysAgo(18),
      verifiedAtUtc: daysAgo(10),
    },
    {
      id: `opt_${tag}_2`,
      detectedAtUtc: daysAgo(15),
      agent: 'dispatch',
      status: 'deployed',
      whatWasDetected: 'Plumbers declined offers missing the customer ZIP code up front.',
      whatWasChanged: 'Job offers now lead with area, ZIP, and required specialty before the window.',
      gradeDelta: null,
      deployedAtUtc: daysAgo(6),
      verifiedAtUtc: null,
    },
    {
      id: `opt_${tag}_3`,
      detectedAtUtc: daysAgo(8),
      agent: 'chat',
      status: 'in_tuning',
      whatWasDetected: 'Web chat visitors asking about pricing abandoned before the coverage check.',
      whatWasChanged: 'Tuning the pricing answer to state the dispatch fee before asking for the ZIP.',
      gradeDelta: null,
      deployedAtUtc: null,
      verifiedAtUtc: null,
    },
    {
      id: `opt_${tag}_4`,
      detectedAtUtc: daysAgo(3),
      agent: 'receptionist',
      status: 'detected',
      whatWasDetected: 'Spanish-language callers experienced longer silence before the first response.',
      whatWasChanged: 'Pending: pre-warming the Spanish voice pipeline during greeting.',
      gradeDelta: null,
      deployedAtUtc: null,
      verifiedAtUtc: null,
    },
    {
      id: `opt_${tag}_5`,
      detectedAtUtc: daysAgo(40),
      agent: 'review_taker',
      status: 'verified',
      whatWasDetected: 'Review asks placed within two hours of job completion were declined more often.',
      whatWasChanged: 'Review calls now wait at least one day after completion.',
      gradeDelta: 6,
      deployedAtUtc: daysAgo(32),
      verifiedAtUtc: daysAgo(20),
    },
  ];

  const gradedCalls = calls.filter((c) => c.grade !== null);
  const flags: FlaggedInteraction[] = gradedCalls.slice(0, 4).map((call, i) => ({
    id: `flag_${tag}_${i + 1}`,
    interactionId: call.id,
    submittedAtUtc: addMinutes(call.atUtc, rng.int(60, 26 * 60)),
    submittedBy: rng.pick(config.members).name,
    status: i === 0 ? 'submitted' : i === 1 ? 'under_review' : 'resolved',
    reason: rng.pick([
      'Agent quoted the wrong dispatch fee.',
      'Service window was read back incorrectly.',
      'Agent did not confirm the gas-safety checklist.',
      'Tone was abrupt when the customer asked for a supervisor.',
    ] as const),
    resolutionNote: i >= 2 ? 'Confirmed and folded into the current tuning cycle.' : null,
  }));

  /* ---------------- growth ---------------- */

  const publishedReviews: PublishedReview[] = reviewRequests
    .filter((r) => r.status === 'review_posted' && r.postedAtUtc)
    .slice(0, 18)
    .map((r, i) => ({
      id: `pub_${tag}_${pad(i + 1, 2)}`,
      atUtc: r.postedAtUtc!,
      rating: r.postedRating ?? 5,
      excerpt: rng.pick([
        'Fast, professional, and the price matched the quote. The booking call was surprisingly smooth.',
        'They had someone out the same afternoon for our water heater. Great communication.',
        'Booked through the automated line at 9pm and had a plumber by 10am.',
        'Cleared our main drain and cleaned up after. Would use again.',
        'The dispatcher kept us updated the whole way. Solid work.',
      ] as const),
      url: 'https://maps.example.com/review',
      attributed: rng.chance(0.75),
      locationId: r.locationId,
    }));

  const privateFeedback: PrivateFeedback[] = reviewRequests
    .filter((r) => r.status === 'declined')
    .slice(0, 4)
    .map((r, i) => ({
      id: `pf_${tag}_${i + 1}`,
      atUtc: r.calledAtUtc ?? daysAgo(rng.int(2, 20)),
      contactId: r.contactId,
      summary: rng.pick([
        'Happy with the repair but felt the arrival window was too wide.',
        'Wants itemized pricing on the invoice before recommending us.',
        'Plumber was great; hold time on the follow-up call was too long.',
        'Asked not to receive review requests by phone.',
      ] as const),
      sourceInteractionId: r.interactionId ?? '',
      status: i === 0 ? 'new' : 'actioned',
      locationId: r.locationId,
    }));

  const campaignContacts = (n: number, jobShare: number): CampaignContact[] =>
    Array.from({ length: n }, (_, i) => {
      const roll = rng.next();
      const status: CampaignContactStatus =
        roll < 0.25 ? 'queued'
        : roll < 0.5 ? 'attempted'
        : roll < 0.7 ? 'reached'
        : roll < 0.7 + jobShare ? 'job_created'
        : roll < 0.93 ? 'exhausted'
        : 'opted_out';
      return {
        id: `cc_${tag}_${pad(i + 1)}`,
        contactId: contacts[rng.int(0, contacts.length - 1)].id,
        status,
        attempts: status === 'queued' ? 0 : rng.int(1, 3),
        lastOutcome: status === 'queued' ? null : status === 'job_created' ? 'Job created' : rng.pick(['Reached', 'Voicemail', 'No answer'] as const),
        createdJobId: status === 'job_created' && completedJobs.length > 0 ? rng.pick(completedJobs).id : null,
        optOut: status === 'opted_out',
      };
    });

  const campaigns: Campaign[] = [
    {
      id: `camp_${tag}_1`,
      name: 'Water heater tune-up — spring list',
      type: 'seasonal_maintenance',
      status: 'running',
      audienceSize: 140,
      startedAtUtc: daysAgo(12),
      locationId: locIds[0],
      audienceDefinition: ['Completed water heater job 10–24 months ago', 'No open job', 'Not on the do-not-call list'],
      pacing: { callingWindowLocal: '10:00–17:00', maxAttempts: 3, retrySpacingHours: 48 },
      contacts: campaignContacts(24, 0.12),
    },
    {
      id: `camp_${tag}_2`,
      name: 'Past customers — 18-month reengagement',
      type: 'reengagement',
      status: 'paused',
      audienceSize: 220,
      startedAtUtc: daysAgo(30),
      locationId: locIds[0],
      audienceDefinition: ['Any completed job 18+ months ago', 'No contact in the last 6 months'],
      pacing: { callingWindowLocal: '11:00–18:00', maxAttempts: 2, retrySpacingHours: 72 },
      contacts: campaignContacts(18, 0.08),
    },
    {
      id: `camp_${tag}_3`,
      name: 'Sump pump pre-season check',
      type: 'follow_up',
      status: 'draft',
      audienceSize: 85,
      startedAtUtc: null,
      locationId: locIds[Math.min(1, locIds.length - 1)],
      audienceDefinition: ['Sump pump service in the last 3 years', 'ZIP in flood-prone areas'],
      pacing: { callingWindowLocal: '10:00–16:00', maxAttempts: 3, retrySpacingHours: 48 },
      contacts: [],
    },
  ];

  // Reengagement calls attributed to the campaign.
  for (const c of campaigns[0].contacts.slice(0, 8)) {
    if (c.status === 'queued') continue;
    callSeq += 1;
    calls.push({
      id: `call_${tag}_${pad(callSeq, 4)}`,
      kind: 'call',
      atUtc: daysAgo(rng.int(1, 11)),
      direction: 'outbound',
      agent: 'reengagement',
      partyType: 'customer',
      contactId: c.contactId,
      plumberId: null,
      durationSeconds: rng.int(35, 190),
      disposition: c.status === 'job_created' ? 'job_created' : c.status === 'reached' ? 'information_provided' : rng.pick(['voicemail', 'no_answer'] as const),
      priority: 'routine',
      grade: makeGrade(rng.int(78, 95), rng),
      locationId: locIds[0],
      media: null,
      firstAudioResponseMs: rng.int(430, 950),
      costUsd: 0.14,
      extracted: null,
      linked: { jobId: c.createdJobId, dispatchId: null, escalationId: null, reviewRequestId: null, campaignId: campaigns[0].id },
    });
  }

  /* ---------------- knowledge ---------------- */

  const knowledgeBlocks: KnowledgeBlock[] = [
    {
      category: 'services_and_repairs',
      locationId: null,
      entries: [
        { label: 'Core services', value: 'Drain cleaning, leak repair, water heaters, sewer mains, gas lines, fixture installation, sump pumps.' },
        { label: 'Emergency service', value: '24/7 for burst pipes, sewer backups, and suspected gas leaks.' },
        { label: 'Not offered', value: 'New-construction rough-in, septic tank pumping, well systems.' },
      ],
    },
    {
      category: 'pricing_and_fees',
      locationId: null,
      entries: [
        { label: 'Dispatch fee', value: '$89, waived when the customer proceeds with the quoted repair.' },
        { label: 'Emergency surcharge', value: '$150 outside business hours.' },
        { label: 'Quotes', value: 'Flat-rate quotes given on site before work begins. Agents never quote repair totals by phone.' },
      ],
    },
    {
      category: 'plumbers_and_coverage',
      locationId: null,
      entries: [
        { label: 'Network', value: `${config.plumberCount} active plumbers across ${org.serviceAreas.length} service areas.` },
        { label: 'Gas work', value: 'Only gas-certified plumbers are offered gas-line jobs.' },
      ],
    },
    {
      category: 'hours_and_holidays',
      locationId: null,
      entries: [
        { label: 'Office hours', value: 'Mon–Fri 7:00–19:00, Sat 8:00–14:00.' },
        { label: 'After hours', value: 'Emergency intake only; routine requests are scheduled for the next business day.' },
      ],
    },
    {
      category: 'service_areas',
      locationId: null,
      entries: org.serviceAreas.map((a) => ({ label: a.name, value: `ZIP codes: ${a.zips.join(', ')}` })),
    },
    {
      category: 'faq',
      locationId: null,
      entries: [
        { label: 'Are you licensed and insured?', value: 'Yes — licensed, bonded, and insured in all service areas.' },
        { label: 'Do you warranty work?', value: '1-year labor warranty on repairs; manufacturer warranty on installed equipment.' },
      ],
    },
    {
      category: 'intake_rules',
      locationId: null,
      entries: [
        { label: 'Required fields', value: 'Name, callback number, service address, ZIP, issue description, preferred window.' },
        { label: 'Emergency rule', value: 'Suspected gas leaks: advise evacuation, transfer to on-call staff, never schedule as routine.' },
      ],
    },
    {
      category: 'escalation_routing',
      locationId: null,
      entries: org.locations.map((l) => ({ label: l.name, value: `Forward to ${l.escalationForwardingNumber}` })),
    },
  ];

  const knowledgeRequests: KnowledgeChangeRequest[] = [
    {
      id: `kr_${tag}_1`,
      category: 'pricing_and_fees',
      proposedChange: 'Raise the after-hours emergency surcharge from $150 to $175 starting August 1.',
      reason: 'Updated on-call pay rates.',
      requestedBy: config.members[0].name,
      requestedAtUtc: daysAgo(4),
      status: 'in_review',
      history: [{ at: daysAgo(4), status: 'requested' }, { at: daysAgo(2), status: 'in_review' }],
    },
    {
      id: `kr_${tag}_2`,
      category: 'service_areas',
      proposedChange: `Add ZIP 60618 to the ${org.serviceAreas[0].name} coverage list.`,
      reason: 'Two plumbers now cover that area.',
      requestedBy: config.members[Math.min(1, config.members.length - 1)].name,
      requestedAtUtc: daysAgo(9),
      status: 'scheduled',
      history: [{ at: daysAgo(9), status: 'requested' }, { at: daysAgo(7), status: 'in_review' }, { at: daysAgo(3), status: 'scheduled' }],
    },
    {
      id: `kr_${tag}_3`,
      category: 'faq',
      proposedChange: 'Add an answer about financing options for water heater replacements.',
      reason: 'Asked in 14 calls this month.',
      requestedBy: config.members[0].name,
      requestedAtUtc: daysAgo(16),
      status: 'live',
      history: [
        { at: daysAgo(16), status: 'requested' },
        { at: daysAgo(14), status: 'in_review' },
        { at: daysAgo(12), status: 'scheduled' },
        { at: daysAgo(10), status: 'live' },
      ],
    },
  ];

  /* ---------------- agents registry ---------------- */

  const agents: AgentRegistryEntry[] = [
    {
      id: 'receptionist',
      name: 'AI Receptionist',
      type: 'inbound',
      channel: 'voice',
      icon: 'Headset',
      isCustom: false,
      slug: 'receptionist',
      metricsContract: [
        { key: 'inbound_calls', label: 'Inbound Calls Handled', format: 'count' },
        { key: 'jobs_created', label: 'Jobs Created', format: 'count' },
        { key: 'job_creation_rate', label: 'Job Creation Rate', format: 'percent', description: 'Jobs created from completed inbound service-intent conversations.' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
    {
      id: 'dispatch',
      name: 'Plumber Dispatch Agent',
      type: 'outbound',
      channel: 'voice',
      icon: 'PhoneForwarded',
      isCustom: false,
      slug: 'dispatch',
      metricsContract: [
        { key: 'outbound_calls', label: 'Outbound Calls Handled', format: 'count' },
        { key: 'assignments', label: 'Assignments Secured', format: 'count' },
        { key: 'assignment_rate', label: 'Assignment Rate', format: 'percent' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
    {
      id: 'chat',
      name: 'Chat Agents',
      type: 'inbound',
      channel: 'chat',
      icon: 'Bot',
      isCustom: false,
      slug: 'chat',
      metricsContract: [
        { key: 'sessions', label: 'Chat Sessions', format: 'count' },
        { key: 'jobs_created', label: 'Jobs Created', format: 'count' },
        { key: 'resolution_rate', label: 'Resolution Rate', format: 'percent' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
    {
      id: 'review_taker',
      name: 'Review Taker',
      type: 'outbound',
      channel: 'voice',
      icon: 'Star',
      isCustom: false,
      slug: 'review-taker',
      metricsContract: [
        { key: 'asks', label: 'Review Asks Delivered', format: 'count' },
        { key: 'posted', label: 'Reviews Posted', format: 'count' },
        { key: 'conversion', label: 'Ask-to-Post Rate', format: 'percent' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
    {
      id: 'reengagement',
      name: 'Reengagement',
      type: 'outbound',
      channel: 'voice',
      icon: 'PhoneOutgoing',
      isCustom: false,
      slug: 'reengagement',
      metricsContract: [
        { key: 'calls', label: 'Outreach Calls', format: 'count' },
        { key: 'reached', label: 'Customers Reached', format: 'count' },
        { key: 'jobs_created', label: 'Jobs Created', format: 'count' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
    {
      id: 'post_service_followup',
      name: 'Post-Service Follow-Up',
      type: 'outbound',
      channel: 'voice',
      icon: 'PhoneCall',
      isCustom: true,
      slug: 'post-service-follow-up',
      metricsContract: [
        { key: 'calls', label: 'Follow-Up Calls', format: 'count' },
        { key: 'reached', label: 'Customers Reached', format: 'count' },
        { key: 'issues_detected', label: 'Issues Detected', format: 'count', description: 'Follow-ups that surfaced a problem needing a return visit.' },
        { key: 'avg_qa', label: 'Average QA Grade', format: 'count' },
      ],
    },
  ];

  /* ---------------- live calls ----------------
   * Each live call exists twice, deliberately in sync: as an `in_progress` CallInteraction
   * (so the Conversations tables and LiveCallsPanel render it with its streaming
   * transcript) and as a LiveCallNow row (agent, party, stage) for the Overview panel.
   */

  const liveCalls: LiveCallNow[] = [];
  if (config.liveCallCount >= 1) {
    const c = makeContact(locIds[0], 'en');
    const startedAt = minutesAgo(3);
    callSeq += 1;
    const callId = `call_${tag}_live1`;
    const custName = `${c.identity!.firstName} ${c.identity!.lastName}`;
    calls.unshift({
      id: callId,
      kind: 'call',
      atUtc: startedAt,
      direction: 'inbound',
      agent: 'receptionist',
      partyType: 'customer',
      contactId: c.id,
      plumberId: null,
      durationSeconds: 180,
      disposition: 'in_progress',
      priority: 'routine',
      grade: null,
      locationId: c.locationId,
      media: {
        recordingUrl: '',
        transcript: intakeTranscript(custName, c.serviceAddress, startedAt),
        consentDisclosureAtUtc: null,
      },
      firstAudioResponseMs: 640,
      costUsd: 0,
      extracted: null,
      linked: { jobId: null, dispatchId: null, escalationId: null, reviewRequestId: null, campaignId: null },
    });
    liveCalls.push({
      id: callId,
      agent: 'receptionist',
      direction: 'inbound',
      partyType: 'customer',
      partyLabel: `${c.identity!.firstName} ${c.identity!.lastName[0]}.`,
      startedAtUtc: startedAt,
      stage: LIVE_STAGES[1],
    });
  }
  if (config.liveCallCount >= 2) {
    const startedAt = minutesAgo(1);
    callSeq += 1;
    const callId = `call_${tag}_live2`;
    calls.unshift({
      id: callId,
      kind: 'call',
      atUtc: startedAt,
      direction: 'outbound',
      agent: 'dispatch',
      partyType: 'plumber',
      contactId: null,
      plumberId: plumbers[0].id,
      durationSeconds: 60,
      disposition: 'in_progress',
      priority: 'urgent',
      grade: null,
      locationId: locIds[0],
      media: {
        recordingUrl: '',
        transcript: dispatchAcceptTranscript(plumbers[0].name, 'Sewer line clearing', org.serviceAreas[0].name, startedAt),
        consentDisclosureAtUtc: null,
      },
      firstAudioResponseMs: 520,
      costUsd: 0,
      extracted: null,
      linked: { jobId: null, dispatchId: null, escalationId: null, reviewRequestId: null, campaignId: null },
    });
    liveCalls.push({
      id: callId,
      agent: 'dispatch',
      direction: 'outbound',
      partyType: 'plumber',
      partyLabel: plumbers[0].name,
      startedAtUtc: startedAt,
      stage: 'Offering job — awaiting response',
    });
  }

  /* ---------------- suppression ---------------- */

  const suppressionList: SuppressionEntry[] = [
    { id: `sup_${tag}_1`, phoneE164: '+13125559981', source: 'customer_opt_out', addedAtUtc: daysAgo(21), consentBasis: 'Opt-out during review call' },
    { id: `sup_${tag}_2`, phoneE164: '+13125559442', source: 'complaint', addedAtUtc: daysAgo(45), consentBasis: null },
    { id: `sup_${tag}_3`, phoneE164: '+13125559107', source: 'manual_add', addedAtUtc: daysAgo(8), consentBasis: 'Requested by staff' },
  ];

  /* ---------------- sort & bundle ---------------- */

  calls.sort((a, b) => b.atUtc.localeCompare(a.atUtc));
  chats.sort((a, b) => b.atUtc.localeCompare(a.atUtc));
  jobs.sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  escalations.sort((a, b) => b.atUtc.localeCompare(a.atUtc));

  return {
    org,
    contacts,
    plumbers,
    jobs,
    dispatchRecords,
    calls,
    chats,
    escalations,
    optimizationEvents,
    flags,
    reviewRequests,
    privateFeedback,
    publishedReviews,
    campaigns,
    knowledgeBlocks,
    knowledgeRequests,
    members: config.members,
    lines: config.lines,
    suppressionList,
    invoices: config.invoices,
    agents,
    liveCalls,
    minutesConsumed: config.minutesConsumed,
    chatSessionsConsumed: config.chatSessionsConsumed,
  };
}
