"use client";
import Header from "@/app/_components/Header";
import { setBetaModalOpen } from "@/app/redux/reducers/basicData";
import { NextPage } from "next";
import React from "react";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";

const Page: NextPage = () => {
  const dispatch = useDispatch();
  return (
    <div className="min-h-screen bg-[#141415] text-white flex flex-col items-center gap-12 md:gap-20 px-6 py-36 overflow-hidden">
      <Header />

      {/* Intro Section */}
      <section className="max-w-4xl w-full text-left space-y-2">
        <p className="text-xs text-gray-400 font-sans font-medium"> FEATURES</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-6">
          superblocks Features tailored to your success
        </h1>
        <p className="text-sm md:text-[15px] font-sans font-medium">
          Creating a UI shouldn&apos;t drain your time or patience, whether
          you&apos;re designing, developing, or managing the process.
          <br />
          <br /> superblocks is built to simplify that journey, delivering tools
          that work for you, not against you.
        </p>
      </section>

      {/* The Challenge Section */}
      <section className="max-w-4xl w-full text-left">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          The UI Challenge You Face
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          You&apos;ve experienced it: A UI project starts with promise - fresh
          designs, clear goals.
          <br />
          <br /> Then it stalls, designers spend hours perfecting layouts that
          shift off course during implementation. Developers lose days aligning
          elements with tools that forget key details. Managers & Founders track
          progress that lags behind, stretched thin by revisions and delays.
          It&apos;s a familiar struggle.
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          I&apos;ve seen this unfold over years - decades, even—across teams and
          roles. A single page can take 40 hours to align a full interface,
          hundreds more. AI Tools fail to hold your vision, forcing you to
          repeat steps or fix missteps. It&apos;s not about lack of
          skill—it&apos;s about a process that doesn&apos;t support you.
          superblocks changes that.
        </p>

        <p className="text-sm md:text-[15px] font-sans font-medium italic">
          “A week lost to a sidebar that still doesn&apos;t fit. We&apos;ve all
          been there.” - A shared frustration.
        </p>
      </section>

      {/* Why superblocks Matters Section */}
      <section className="max-w-4xl w-full text-left">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          Why superblocks Stands Out
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          With over years of seeing design, development, and project management,
          we&apos;ve felt your pain, AI tools that lose track, processes that
          drag, hours that vanish just like that.
          <br />
          <br />
          <span className="underline">
            superblocks isn&apos;t just another product
          </span>
          ; it&apos;s a solution shaped by those experiences. We&apos;re not
          chasing trends or corporate applause, we&apos;re here to save your
          100+ hours, to make your work smoother and your results stronger.
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium">
          This is about you-your work that deserve to shine, your code that
          should flow, your timelines that need to hold. We&apos;ve built
          superblocks to fit your reality, not to impress a boardroom. It&apos;s
          practical, focused, and designed to deliver what you need, when you
          need it.
        </p>
      </section>

      {/* Features Section */}
      <section className="max-w-4xl w-full text-left">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">
          Features That Deliver Real Value
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          superblocks brings a focused set of features to streamline your App
          creation - each one crafted to save you time and effort with
          efficiency.
          <br />
          <br /> Here&apos;s how they work for you:
        </p>
        <div className="space-y-10">
          <div>
            <h3 className="text-xl font-bold mb-2">Memory: Reliable Context</h3>
            <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
              Tools that forget your input after a flow of chatter waste your
              time.{" "}
              <span className="underline">
                Our Memory feature ensures superblocks retains your
                project&apos;s context
              </span>{" "}
              - your theme, slogan, or any detail—across every step you mention
              in memory field. Designers, your vision stays intact from start to
              finish. Developers, you avoid re-entering specs or fixing stray
              outputs. Founders, you see consistency without chasing updates.
            </p>
            <p className="text-sm md:text-[15px] font-sans font-medium">
              This means no more 20-hour resets when a tool loses track. Your
              project&apos;s foundation holds steady, saving you effort and
              keeping your focus where it belongs on creating, not correcting.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">
              Theme Selection: Your Style, Set and Done
            </h3>
            <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
              Defining your UI&apos;s look shouldn&apos;t mean constant
              adjustments.{" "}
              <span className="underline">Theme Selection with Memory</span>{" "}
              lets you establish your style—colors, typography, tone—and applies
              it everywhere.
            </p>
            <p className="text-sm md:text-[15px] font-sans font-medium">
              That&apos;s hours of “why doesn&apos;t this match?” gone. Your
              design stays true, letting you move forward instead of circling
              back—because your time matters.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">
              Palette: Variants Made Simple
            </h3>
            <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
              Exploring options shouldn&apos;t slow you down. With Palette
              generating multiple UI variants is as simple as click whether
              headers, buttons, layouts based on your context, all in one click.
              Designers, you review choices without starting over. Developers,
              you integrate polished options that fit. Founders, you approve
              faster with less back-and-forth.
            </p>
            <p className="text-sm md:text-[15px] font-sans font-medium">
              A process that took days—mockups, revisions, builds—shrinks to
              hours. You&apos;re not stuck iterating endlessly; you&apos;re
              picking what works, saving time for what&apos;s next.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">
              Realtime Collaboration: Teamwork Redefined
            </h3>
            <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
              Collaboration shouldn&apos;t mean email chains and version
              conflicts. Realtime Collaboration lets your team work together
              live-updates sync instantly whether its code or output.
            </p>
            <p className="text-sm md:text-[15px] font-sans font-medium">
              That&apos;s 20+ hours of “where&apos;s the latest?” cut down to
              real-time results. Your team stays aligned, your work stays fluid
              - because your collaboration should lift you, not slow you.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">
              Project of Your Dreams: Vision to Reality
            </h3>
            <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
              Your ideal UI shouldn&apos;t stay a sketch. Project of Your Dreams
              ties every feature - Memory, Palette, Colloboration — into a tool
              that brings your vision to life. You build with clarity, not chaos
              and the project hits the mark, on time.
            </p>
            <p className="text-sm md:text-[15px] font-sans font-medium">
              So, the months of grind turned into days of progress. Your ideas
              deserve to shine, not fade.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-4xl w-full text-left">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          How superblocks Streamlines Your Work
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          Here&apos;s how superblocks transforms your building process - clear
          steps that save you days:
        </p>
        <ol className="list-decimal list-inside text-sm md:text-[15px] font-sans font-medium space-y-6">
          <li className="mb-4">
            <strong>Define Your Needs</strong> - You start with a simple “A
            modern dashboard, blue tones.”, also telling with framework &
            css-library.
          </li>
          <li className="mb-4">
            <strong>Set Your Theme</strong> - In{" "}
            <span className="underline">
              Memory field put up your style, your goals, your theme
            </span>{" "}
            - keeping it consistent throughout. No lost details, just a solid
            base, ready for every step—no drift, no rework.
          </li>
          <li className="mb-4">
            <strong>Explore Variants</strong> - Palette delivers options -
            Another click generates multiple layouts or components - that match
            your context. You choose what fits, cutting days of iteration into
            hours.
          </li>
          <li className="mb-4">
            <strong>Collaborate Together </strong> - Realtime Collaboration
            syncs your team - designers tweak, developers adjust, Founders
            review all in the moment. No delays, just progress.
          </li>
          <li className="mb-4">
            <strong>Adapt and Refine</strong> - One-Click Multi-Theme Metadata
            shifts styles; Responsive Variants ensure fit of components. You
            refine fast, keeping everything on track.
          </li>
          <li className="mb-4">
            <strong>Launch Your Vision</strong> - Project of Your Dreams wraps
            it up - code&apos;s ready, UI&apos;s live. From start to finish,
            it&apos;s your idea, realized in days.
          </li>
        </ol>
        <p className="text-sm md:text-[15px] font-sans font-medium mt-4">
          That&apos;s your 100+ hour slog - revisions, missteps, delays—turned
          into a focused flow. You gain time to create, not iterate.
        </p>
      </section>

      {/* How It Changes Things Section */}
      <section className="max-w-4xl w-full text-left">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          How superblocks Elevates Your Work
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          superblocks doesn&apos;t just tweak your process - it redefines it.
          <br />
          <br /> Here&apos;s what shifts:
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          <span className="underline">Your concepts stay true</span> - no more
          hours lost to misalignment. You shape your vision with tools that
          respect your intent, freeing you to focus on the next idea.
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          <span className="underline">Your builds start strong</span> - no
          chasing stray details or fixing broken outputs. You get reliable
          pieces that fit, letting you deliver faster and cleaner.
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-4">
          <span className="underline">Your oversight simplifies</span> — no
          endless updates or stalled tasks. You guide a team that&apos;s aligned
          in real time, hitting goals without the scramble.
        </p>
        <p className="text-sm md:text-[15px] font-sans font-medium">
          Together, it&apos;s 100+ hours saved - days, not weeks - to turn your
          project into reality. It&apos;s about making your effort count, not
          just keeping up.
        </p>
      </section>

      {/* Line */}
      <motion.div
        className="w-full h-[1px] bg-gradient-to-r from-[#0A0A0A] via-white to-[#0A0A0A] opacity-50 my-5"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 0.5, scaleX: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />

      {/* Early Access Section */}
      <section className="max-w-4xl w-full text-center">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          Join superblocks
        </h2>
        <p className="text-sm md:text-[15px] font-sans font-medium mb-6 text-balance">
          <span className="underline">superblocks is Beta Right Now</span>, and
          we&apos;re inviting you to be a part of a strong 150+ devs, designers
          and founders who want to make it happen!
          <br />
          <br /> Have ideas or questions? Reach us at{" "}
          <a
            href="mailto:feedback@superblocks.xyz"
            className="underline text-blue-400"
          >
            feedback@superblocks.xyz
          </a>
          . Your input drives this—let&apos;s make it work for you.
        </p>
        <div className="text-center">
          <button
            onClick={() => {
              dispatch(setBetaModalOpen(true));
            }}
            className="bg-white hover:bg-gray-200 text-black cursor-pointer py-3 px-8 rounded-lg text-sm md:text-[15px] font-sans font-medium"
          >
            Request Beta Access Now
          </button>
        </div>
      </section>
    </div>
  );
};

export default Page;
