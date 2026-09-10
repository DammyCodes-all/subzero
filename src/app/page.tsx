import { HeroSection } from "@/components/marketing/HeroSection";
import { AttentionSection } from "@/components/marketing/landing/AttentionSection";
import { CancelDetailSection } from "@/components/marketing/landing/CancelDetailSection";
import { CancelPathsSection } from "@/components/marketing/landing/CancelPathsSection";
import { EvidenceSection } from "@/components/marketing/landing/EvidenceSection";
import { FinalCtaSection } from "@/components/marketing/landing/FinalCtaSection";
import { IntakeSection } from "@/components/marketing/landing/IntakeSection";
import { ProblemSection } from "@/components/marketing/landing/ProblemSection";
import { RenewalSection } from "@/components/marketing/landing/RenewalSection";
import { StatusSection } from "@/components/marketing/landing/StatusSection";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export default function Home() {
  return (
    <MarketingLayout>
      <HeroSection />
      <ProblemSection />
      <AttentionSection />
      <IntakeSection />
      <RenewalSection />
      <CancelDetailSection />
      <CancelPathsSection />
      <EvidenceSection />
      <StatusSection />
      <FinalCtaSection />
    </MarketingLayout>
  );
}
