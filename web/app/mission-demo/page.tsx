import { GrowthMissionClient, type MissionProspect, type MissionView } from "@/components/growth-mission-client";
import "../growth-mission.css";

const updatedAt = "2026-10-28T09:00:00.000Z";
const lead = (id: string, company: string, status: string, draft = true): MissionProspect => ({
  id, company, url: `https://${id}.example.com/`, status, source: "weekly-pack", updatedAt,
  context: `${company} is an independent clinic in Greater Manchester with a public booking website. The listing shows recent reviews and an active contact page.`,
  draft: draft ? `Hi ${company}, I noticed the booking flow is difficult to use on mobile. We build clearer booking websites for independent clinics.` : null,
  email: `hello@${id}.example.com`,
});
const mission: MissionView = {
  id: "sample", businessId: "sample-business", businessName: "Northline Studio", goal: "booked-calls", target: 10,
  deadline: "2026-11-27T23:59:59.999Z", offer: "Booking websites for independent clinics", audience: "Independent clinics in Greater Manchester",
  status: "active", createdAt: updatedAt, updatedAt,
  leads: [
    { id: "one", decision: "pending", reviewedAt: null, repliedAt: null, bookedAt: null, wonAt: null, lead: lead("oak-clinic", "Oakfield Clinic", "draft-ready") },
    { id: "two", decision: "pending", reviewedAt: null, repliedAt: null, bookedAt: null, wonAt: null, lead: lead("wellness-centre", "Haven Wellness Centre", "new", false) },
    { id: "three", decision: "approved", reviewedAt: updatedAt, repliedAt: updatedAt, bookedAt: updatedAt, wonAt: null, lead: lead("river-dental", "Riverside Dental", "meeting-booked") },
    { id: "four", decision: "rejected", reviewedAt: updatedAt, repliedAt: null, bookedAt: null, wonAt: null, lead: lead("green-physio", "Greenway Physio", "new") },
  ],
};

export default function MissionDemo() {
  return <main className="mission-page"><GrowthMissionClient tier="ELITE" businesses={[{ id: "sample-business", name: "Northline Studio", offer: mission.offer, audience: mission.audience, active: true }]} missions={[{ id: mission.id, businessName: mission.businessName, goal: mission.goal, target: mission.target, status: mission.status }]} mission={mission} prospects={[lead("harbour-care", "Harbour Care", "new"), lead("moss-clinic", "Moss Clinic", "qualified")]} /></main>;
}
