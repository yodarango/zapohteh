import { Select } from "@ds";

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

export const FilterDropdowns = ({
  subjects,
  availableYears,
  selectedSubjects,
  setSelectedSubjects,
  selectedStatus,
  showStatus = true,
  setSelectedStatus,
  selectedYears,
  setSelectedYears,
  selectedMonths,
  setSelectedMonths,
  hasFilters,
  clearFilters,
}) => (
  <div className='mb-6 flex flex-wrap items-center gap-2'>
    <Select
      aria-label='Filter by subjects'
      placeholder='Subjects'
      multiple
      value={[...selectedSubjects]}
      onChange={(values) => setSelectedSubjects(new Set(values))}
      options={subjects.map((subject) => ({
        value: subject.id,
        label: subject.name,
        color: subject.color,
      }))}
      className='w-[calc(50%-0.25rem)] sm:w-40'
    />
    {showStatus && <Select
      aria-label='Filter by course status'
      value={selectedStatus}
      onChange={setSelectedStatus}
      options={[
        { value: "", label: "All statuses" },
        { value: "complete", label: "Complete" },
        { value: "incomplete", label: "Incomplete" },
      ]}
      className='w-[calc(50%-0.25rem)] sm:w-40'
    />}
    <Select
      aria-label='Filter by years'
      placeholder='Years'
      multiple
      value={[...selectedYears]}
      onChange={(values) => setSelectedYears(new Set(values))}
      options={[...new Set([...availableYears, ...selectedYears])]
        .sort((a, b) => a - b)
        .map((year) => ({ value: year, label: String(year) }))}
      className='w-[calc(50%-0.25rem)] sm:w-40'
    />
    <Select
      aria-label='Filter by months'
      placeholder='Months'
      multiple
      value={[...selectedMonths]}
      onChange={(values) => setSelectedMonths(new Set(values))}
      options={MONTHS}
      className='w-[calc(50%-0.25rem)] sm:w-40'
    />
    {hasFilters && (
      <button
        type='button'
        onClick={clearFilters}
        className='rounded-full border border-dr-border px-3 py-1.5 text-sm font-medium text-dr-text-muted transition-all hover:border-dr-danger hover:text-dr-danger'
      >
        Clear
      </button>
    )}
  </div>
);