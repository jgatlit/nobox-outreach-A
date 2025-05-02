import { ImportHistoricalDataForm } from './ImportHistoricalDataForm';

interface ImportHistoricalDataFormProps {
  leadId: number;
}

export default function ImportHistoricalDataFormWrapped(props: ImportHistoricalDataFormProps) {
  return <ImportHistoricalDataForm {...props} />;
}