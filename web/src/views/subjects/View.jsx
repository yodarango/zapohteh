import { useState, useEffect } from "react";
import { Button, Input, TextArea, Loading } from "@ds";
import {
  API_GET_SUBJECTS,
  API_POST_SUBJECTS,
} from "@constants";
import { useGet } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

export const SubjectsView = () => {
  const { showToast } = useAppContext();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, loading, error, refetch } = useGet({ url: API_GET_SUBJECTS });
  const subjects = data || [];

  useEffect(() => {
    if (error) {
      showToast({
        type: "danger",
        message: String(error),
      });
    }
  }, [error, showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !color.trim() || creating) {
      showToast({
        type: "danger",
        message: "Please enter a name and a color",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(API_POST_SUBJECTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          color: color.trim(),
        }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to create subject"),
        });
      } else {
        showToast({ type: "success", message: "Subject created" });
        setName("");
        setDescription("");
        setColor("");
        refetch();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Subjects</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Organize your courses by subject.
      </p>

      <form
        onSubmit={handleSubmit}
        className='mb-8 rounded-2xl border border-dr-border bg-dr-surface p-4'
      >
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <Input
            label='Name'
            placeholder='e.g. History'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Color
            </label>
            <div className='flex items-center gap-3'>
              <input
                type='color'
                value={color || "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className='h-10 w-10 cursor-pointer rounded-lg border border-dr-border bg-transparent'
              />
              <Input
                placeholder='#3b82f6 or rgb(59, 130, 246)'
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className='flex-1'
              />
            </div>
          </div>
        </div>
        <div className='mt-4'>
          <TextArea
            label='Description'
            placeholder='Brief description of the subject'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className='mt-4 flex items-center justify-end'>
          <Button primary disabled={creating} isLoading={creating}>
            Create subject
          </Button>
        </div>
      </form>

      {loading && (
        <div className='flex justify-center py-12'>
          <Loading size={40} />
        </div>
      )}

      {!loading && !error && subjects.length === 0 && (
        <p className='py-12 text-center text-dr-text-muted'>
          No subjects yet. Create one above.
        </p>
      )}

      {!loading && !error && subjects.length > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className='rounded-2xl border border-dr-border bg-dr-surface p-4'
            >
              <div className='mb-3 flex items-center gap-2'>
                <span
                  className='inline-block h-3 w-3 rounded-full'
                  style={{ backgroundColor: subject.color }}
                />
                <span className='font-semibold text-dr-text'>
                  {subject.name}
                </span>
              </div>
              {subject.description && (
                <p className='text-sm text-dr-text-muted'>
                  {subject.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
