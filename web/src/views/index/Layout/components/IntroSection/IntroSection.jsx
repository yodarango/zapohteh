import { useState } from "react";
import { Button, TextArea } from "@ds";
import { API_POST_LEARN_ABOUT } from "@constants";
import { usePost } from "@utils";

// Available research depth levels for a topic
const RESEARCH_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const IntroSection = () => {
  const [input, setInput] = useState("");
  const [level, setLevel] = useState("medium");
  const { post, loading } = usePost({
    url: API_POST_LEARN_ABOUT,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    post({ input: input.trim(), level });
  };

  return (
    <section className='mx-auto max-w-[1200px] px-4 py-8'>
      <div className='text-center p-5 mb-6 border border-blue-500 bg-[rgba(15,57,83,0.44)] rounded-2xl'>
        <h1 className='text-2xl md:text-3xl font-bold mb-6'>
          What do you want to learn about today
        </h1>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-3'>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Type a topic...'
              minRows={3}
            />
            {/* Research depth selector */}
            <div className='flex gap-3'>
              {RESEARCH_LEVELS.map((option) => (
                <label
                  key={option.value}
                  className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    level === option.value
                      ? "border-blue-500 bg-blue-500/20 text-white"
                      : "border-blue-500/40 text-white/60 hover:border-blue-500/70"
                  }`}
                >
                  <input
                    type='radio'
                    name='research-level'
                    value={option.value}
                    checked={level === option.value}
                    onChange={() => setLevel(option.value)}
                    className='sr-only'
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <Button type='submit' primary isLoading={loading} className='w-full'>
            Submit
          </Button>
        </form>
      </div>
    </section>
  );
};
