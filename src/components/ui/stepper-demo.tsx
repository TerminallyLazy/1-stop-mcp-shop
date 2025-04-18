import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "../../components/ui/stepper";

const steps = [
  {
    step: 1,
    title: "Step One", 
    description: "Desc for step one",
  },
  {
    step: 2,
    title: "Step Two",
    description: "Desc for step two",
  },
  {
    step: 3,
    title: "Step Three",
    description: "Desc for step three",
  },
];

function StepperDemo() {
  return (
    <div className="space-y-8 text-center min-w-[300px]">
      <Stepper defaultValue={2} orientation="vertical">
        {steps.map(({ step, title, description }) => (
          <StepperItem
            key={step}
            step={step}
            className="relative items-start [&:not(:last-child)]:flex-1"
          >
            <StepperTrigger className="items-start pb-12 last:pb-0">
              <StepperIndicator />
              <div className="mt-0.5 space-y-0.5 px-2 text-left">
                <StepperTitle>{title}</StepperTitle>
                <StepperDescription>{description}</StepperDescription>
              </div>
            </StepperTrigger>
            {step < steps.length && (
              <StepperSeparator className="absolute inset-y-0 left-3 top-[calc(1.5rem+0.125rem)] -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
            )}
          </StepperItem>
        ))}
      </Stepper>
      <p className="mt-2 text-xs text-muted-foreground" role="region" aria-live="polite">
        Vertical stepper with inline titles and descriptions
      </p>
    </div>
  );
}

export { StepperDemo };
