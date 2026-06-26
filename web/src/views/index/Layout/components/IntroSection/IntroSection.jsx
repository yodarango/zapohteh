import welcomeImage from "@images/statuses/welcome.webp";
import { Link } from "react-router-dom";
import { Button } from "@ds";
import { ROUTE_AUTH } from "@constants";

export const IntroSection = () => {
  return (
    <section className='mx-auto max-w-[1200px] px-4 py-8'>
      {/* Hero Section */}
      <div className='relative overflow-hidden text-center mb-8 rounded-[2rem] px-8 py-12'>
        <div>
          <h1 className='text-5xl md:text-6xl font-extrabold mb-4 text-dr-text'>
            Welcome to <span className='text-dr-accent'>Goilerplate</span>
          </h1>
          <div className='my-8'>
            <img
              src={welcomeImage}
              alt='Welcome to Goilerplate'
              className='mx-auto max-w-[30rem] w-full h-auto rounded-2xl transition-transform duration-300 hover:scale-105 hover:rotate-2'
            />
          </div>
          <p className='text-xl mb-2 text-dr-text/80'>
            A clean starting point for full-stack Go and React applications.
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className='text-center p-5 mb-6 border border-blue-500 bg-[rgba(15,57,83,0.44)] rounded-2xl'>
        <h2 className='mb-2 text-2xl font-bold'>Ready to build?</h2>
        <p className='mb-4'>
          Authentication, database connectivity, and a modern UI are already
          wired up. Start adding your own features.
        </p>
        <div className='flex items-center justify-center gap-4'>
          <Link to={ROUTE_AUTH} className='w-full'>
            <Button
              secondary
              className='w-full hover:-translate-y-1 transition-transform duration-300'
            >
              Sign In or Create Account
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
