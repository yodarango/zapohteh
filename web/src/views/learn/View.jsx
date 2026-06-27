import { useParams, useNavigate } from "react-router-dom";
import { marked } from "marked";
import { Button, Loading } from "@ds";
import { API_GET_TOPIC, ROUTE_HOME } from "@constants";
import { useGet } from "@utils";

/* *************************************************************************************************
 * Renders the assembled markdown research for a single topic. The markdown is fetched from the
 * backend and converted to HTML with marked before being displayed.
 * *************************************************************************************************
 */
export const LearnView = () => {
  const { topic } = useParams();
  const navigate = useNavigate();

  const { data, loading, error } = useGet({
    url: `${API_GET_TOPIC}?name=${encodeURIComponent(topic)}`,
  });

  if (loading) {
    return (
      <div className='flex justify-center py-20'>
        <Loading size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <p className='py-20 text-center text-red-400'>{String(error)}</p>
    );
  }

  const html = marked.parse(data?.content || "");

  return (
    <div className='mx-auto w-full max-w-[800px] px-4 py-8'>
      <Button
        secondary
        className='mb-6'
        onClick={() => navigate(ROUTE_HOME)}
      >
        <ion-icon name='arrow-back-outline'></ion-icon>
        <span className='ml-2'>Back</span>
      </Button>
      <div
        className='research-content'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
