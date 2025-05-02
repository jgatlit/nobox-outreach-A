import { EmailGeneratorForm } from "./EmailGeneratorForm";

interface EmailGeneratorFormProps {
  leadId: number;
  lead: any;
  enrichment: any;
}

export default function EmailGeneratorFormWrapped(props: EmailGeneratorFormProps) {
  return <EmailGeneratorForm {...props} />;
}
