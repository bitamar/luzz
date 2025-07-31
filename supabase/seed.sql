-- ---------- Seed sample data ----------
insert into studios (slug, name)
values ('ceramikaza', 'Ceramikaza Studio');

with s as (select id from studios where slug = 'ceramikaza')
insert into customers (studio_id, first_name, contact_email)
select id, 'Dana', 'dana@example.com' from s;

with s as (select id from studios where slug = 'ceramikaza')
insert into slots (studio_id, title, starts_at, duration_min, recurrence_rule,
                   price, min_participants, max_participants, for_children)
select id,
       'Kids Tuesday 17:00',
       '2025-07-29 14:00:00+00',
       90,
       'FREQ=WEEKLY;BYDAY=TU',
       100.00,
       1,
       8,
       true
from s;

with c as (select id, studio_id from customers limit 1)
insert into invites (studio_id, customer_id, short_hash)
select studio_id, id, 'abc123' from c;

with c as (select id from customers limit 1)
insert into children (customer_id, first_name, avatar_key)
select id, 'Maya', 'bear' from c;

with sl as (select id from slots limit 1),
     ch as (select id from children limit 1)
insert into bookings (slot_id, child_id)
select sl.id, ch.id from sl, ch; 