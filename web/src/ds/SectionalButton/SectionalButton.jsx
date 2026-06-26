export const SectionalButtom = (props) => {
  const { className, children, label, icon, value, ...rest } = props;

  return (
    <button
      className={`flex w-full justify-between rounded-2xl bg-dr-surface p-2 transition-all duration-300 hover:scale-[0.98] shadow-[0_0_0.2rem_#350c8cab,-0.2rem_0_1rem_#350c8cab,0.2rem_0_1rem_#350c8cab] hover:shadow-none ${className}`}
      {...rest}
    >
      <span>{label}</span>
      <span className='inline-flex items-center justify-end gap-2 text-dr-text'>
        <span>{value}</span>
        <ion-icon name={icon} />
      </span>
    </button>
  );
};
