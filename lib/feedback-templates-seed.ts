import type { FeedbackTemplate } from "./feedback-templates";

function seed(id: string, group: string, title: string, body: string): FeedbackTemplate {
  return { id, group, title, body: body.trim(), custom: false };
}

/** Built-in starts from Common Feedback for Tasks. Custom replies live in Supabase. */
export const SEEDED_FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  seed(
    "task1-purpose",
    "Task 1",
    "Purpose of the question",
    `Part of the purpose of Task 1 is to illustrate first-hand what I mean when I say that you can do questions to guide your studying and be more effective with your time. For most students, they don’t really need revision for impairments, or if so, it’s a small amount and doing the question and marking may actually BE the revision they needed. Costing? Yeah… most students need some more work on that… and it also differs in terms of the TYPE of revision needed. So… two questions, one lot of revision needed. That’s effective. Feels horrible, I know… but it’s effective!`
  ),
  seed(
    "task1-impairments",
    "Task 1",
    "Impairments",
    `Be careful… ALWAYS put an answer in first and ALWAYS note ALL the items in a calculation. I’ve added a video to the end of Task 1 detailing this, and using a few student submissions to give you a few examples. Pay attention to how the marker looks at it and how to try make sense of what someone’s done if they’re not clear… I think it will be valuable to check out :) Keep an eye on the time and as you’re running out, create some kind of total in your calcs, and dump it in your ‘answer’. The marker will start at your answer, and then go back to the references you’ve provided for the calcs.`
  ),
  seed(
    "task1-variances",
    "Task 1",
    "Variances",
    `This is an interesting one, because it’s less about theory, as it is about understanding what the calculations are telling us. The more we can visualise what the calculations, and the components thereof, actually mean to the production, the operations, the budgets, the easier it becomes to turn that ‘figure’ into a discussion, because you know what it MEANS.

In a lot of cases, I find students have learnt variance calculations and formats, and how to do the calcs, but they don’t actually visualise what they’re doing, and what it means. So, the interpretation of information is purely theory, because the numbers don’t ‘speak’ to them. So, the (slightly weird!) question for you is: Do the numbers ‘speak’ to you? :) I’ve also added a video to the end of Task 1 relating to ‘how’ we study this stuff. I think it may help, both for this topic as well as others you may feel this way about.

Every calc you do in your studies creates, illustrates, puts a number to a ‘picture’, an event, a situation. It’s like taking a photo of what’s going on, and then translating the picture into a number. Stupid example… you can take a picture of a rundown building with broken windows, abandoned, broken roofing etc. That tells a story… “This property is not being used, and is probably worth less than it used to be”. In accounting, we put a number to that story: we create an impairment. So, when we see ‘impairment’ calculations, we mentally visualise an asset that’s broken, doesn’t work, is old. Other people would just see a number next to impairments… but you can tell them the story, because you understand what that calculation and number reflects and means to the company.

Question is… does the variance stuff tell you a story?

Obviously I don’t know how well you know this stuff, so if this is super-basic, my apologies… but it is something that a lot of my students struggle with, and more so as the questions become more interpretive, because the marker WANTS to know whether you understand that picture. Can you translate the numbers into ‘stuff’ that affects the business?

Most students need some work on the costing stuff, but it’s not ‘go back and re-memorise the stuff’… we need to have a better fundamental understanding of the shape and purpose of the stuff. Many students study variances as a ‘learnt’ thing instead of understanding the ‘shape’ of the problem we’re trying to solve. :)

We’re looking at the difference between what something actually costs to make, and what our ‘ideal / standard’ cost is. Our ‘standard’ will NEVER be our actual. The mix variance is about whether the difference is coming from the fact that you’re using a different AMOUNT of materials (2 litres instead of 1.5 litres). We need to calculate how much extra this is costing us, but the CAUSE of the variance isn’t the unit price of the material, it’s from the quantity we’re using. The price variance is a different conversation… are we paying more per litre? It’s important to understand the cause, because they have different solutions. If the material mix is the cause of the extra costs… then we need to streamline our production, check for wastage etc. If it’s a price issue, then we need to negotiate with suppliers, or increase prices if we realise that inflation has increased (or the US tariffs, for example!). So, the shape of the problem with variances is about the fact that your actual cost is higher than your standard cost… but we need to scratch at the cause. The cause will help us solve the problem :)`
  ),
  seed(
    "task2-purpose",
    "Task 2",
    "Purpose of the question",
    `This was a question that students really struggled with in Jan ’24, so I wanted to put this in nice and early and freak you out :) (Just kidding!). This question has some super-basics that most students are comfy with, the basic deduction ‘stuff’, but there are levels in this question that make the basics quite tricky to work with. The application of the basics can only really be practiced using different situations. There may be a little bit of theory to revise, but the reality is that there are SO many different situations that are tricky to deal with that your skill of being able to discuss the production of income vs capital in nature will be important. So… basic theory, but advanced level of application.

Also be aware that your communication may actually be MORE important than your knowledge here… in the Teaching Notes video at the end of this section… note that SAICA awarded marks for answers that were technically ‘wrong’, but were communicated well.`
  ),
  seed(
    "task2-tax-through-questions",
    "Task 2",
    "Tax through questions",
    `Most students have work to do on Tax… this is good to know, but make sure you do it THROUGH questions. The ‘flat’ theory is not going to convert to marks. Do a question, focus on the basics, and then close the theory gaps afterwards. PLEASE don’t go back to VAT and Tax theory without using questions to guide the reality of how they want you to use the stuff and the importance of the ability to discuss and apply the stuff at far higher levels than the basic statements of the theory.

The main take-away from this… you can see that there ARE basic marks, but the application is trickier, and this is the point here… you can revise all you like, but that application skill ONLY improves with practice and exposure to different questions. The level of the theory doesn’t really change, the sections all say the same thing as they always did, but the questions they ask you about it are weirder and more different and require a higher skill of application.`
  ),
  seed(
    "task2-employees-tax",
    "Task 2",
    "Employees tax calc",
    `The employees tax calc… most people need some revision on the process there. It’s not really complicated, it’s just that if we haven’t done it for a while, we forget the process of shifting between annual and monthly amounts and the weirdness that entails :) Again, you can see that there ARE basic marks, but the application is trickier, and this is the point here… you can revise all you like, but that application skill ONLY improves with practice and exposure to different questions.`
  ),
  seed(
    "task2-ethics",
    "Task 2",
    "Ethics / systematic thinking",
    `The ethics question is more of a systematic thinking challenge. Task 3 should help a little with that. Part of the challenge is WHERE to get the answer from. That means stepping back and asking whether there’s any ‘knowledge base’ that relates to this. This is a really good learning tool, because we suck at this type of thing :) So let’s work on it. If ‘directors’ are mentioned in 5 different things, we need to think of that… we’re used to thinking of ONE place :) We need to force ourselves to think of all our reference books. We can start this by actively running through all the ‘acts’ etc we use (CPC, Co Act, King Code, IFRS, ISA, Tax Act) and asking which of them this relates to. It will be slow to start, but it forces your brain into the habit of thinking beyond just ONE thing. It’s a thinking shift that will become easier and smoother. These types of questions help teach us to think in ‘concepts’ instead of just ‘acts’ :)`
  ),
  seed(
    "task2-buried-treasure",
    "Task 2",
    "Buried Treasure / case study marks",
    `We also need to make sure that we’re getting the maximum value from the case study… I have a mini-Tool called ‘Buried Treasure’ that may help if you struggle with this… calculate how many marks were directly on the case study, that you missed…

https://player.vimeo.com/video/731824782`
  ),
  seed(
    "task3-systematic",
    "Task 3",
    "Systematic thinking",
    `This question works on the skill of systematic thinking and breakdown. One of students' biggest issues is chaotic thinking, probably because you’re panicking, thinking while you’re writing and trying to remember EVERYTHING all at once and get it ALL down in case you forget. Slow down and BREATHE. Practice will make this smoother, but we have to work at it a little ;)

Take a look at the feedback video with the student examples I added at the end of the task… it’s super-helpful to see what the markers see and how things do and don’t work :) This is CRUCIAL because these are marks you CAN get pretty easily, but you have to slow down and approach it systematically.

This is super-important because you can see how many marks you could lose for stuff you DO know. This type of question is a lovely area to earn lots of marks, because you DO know the theory, and so I want you to get loads of marks for it :) But that takes practice of being systematic and structured ;) Make it a habit :)`
  ),
  seed(
    "task3-structure-terrible",
    "Task 3",
    "If structure is terrible",
    `Questions relating to communication skills are the only questions I recommend redoing, because we need to reinforce the skill of writing less, getting to the point, and putting the theory we have floating in our heads, into structured sentences ;)

Here’s the ‘shell’ for you to ‘fill in’ based on the methodology I gave you. Note how much shorter it is, while still getting the theory across. The definitions etc are kept together and clear, and this is not tricky to do since you have the definitions before you start writing. Redo the question using this structure as a reinforcement of a faster way of doing it (obviously filling in the blanks). The more you can ‘think’ in this type of structure for compliance-based questions, the easier and faster you’ll get marks. Think of ANY IFRS… the definitions, recognition criteria, measurement etc… this will keep working and ensure you hit all the important components.

They should look at IAS 38 for guidance on recognition and measurement of the app.

It needs to meet the following criteria:
- The definition of an intangible asset, which means it must be:
- Identifiable
- Non-monetary
- Asset
- Resource controlled by the entity
- As a result of a past event
- Economic benefit should flow to the entity
- Without physical substance
- It must also meet the recognition criteria, which means:
- Economic benefits should flow to the entity from this asset
- The cost can be reliably measured

Therefore…
It will be initially recognised at…
-
-
-`
  ),
  seed(
    "task3-missed-measurement",
    "Task 3",
    "Missed initial measurement",
    `You missed the second component of the question, the initial measurement. In a question like this, by ignoring an entire component, you’re banking on the fact that there are over 10 marks available for just ONE component of the question. That’s dangerous. It’s safer to assume there are 5 marks each, so make sure you at least start ALL the components. In some cases, a component of the question may only have 2 marks available… so you don’t want to ONLY do that section, you want to split your risk. Always divide your time on the question between all the components you identify.`
  ),
  seed(
    "task3-too-much-theory",
    "Task 3",
    "Too much time on theory",
    `Be aware also, that in the solution, there is only one mark for both the theory and application. This is tricky, because we want to write the theory out, and then apply. Take a look at application sentences… your explanation of the theory lands up being IN the application anyway. So, to some extent, you’re discussing the theory IN the application (that’s how the markplan does it). You can’t write two long sentences for only one mark.

I ‘force’ you to ‘identify’ (not rewrite) the theory upfront and break it up, because I know that without this, students will EITHER give the theory OR the application, but not both. The theory components also help structure the thinking, but that ‘one word’ — ‘identifiable’ — is enough to get started on the application. We want to make sure you have time to cover as much as possible, and getting one mark for stuff that takes 8 lines to write is not going to get you lots of marks :)

I would suggest you redo this one, focussing on reducing the volume of what you’re writing :)`
  ),
  seed(
    "task3diy-more-points",
    "Task 3 DIY",
    "Need more points",
    `Hi hi

Nice overall :) You’re right… sadly the strategy stuff only really comes right after experience and more exposure to more and more different scenarios. It’s frustrating, I know. But theory isn’t particularly helpful.

And the practice of communication is super-important. You can see that there’s stuff you know that you can get marks for.

The biggest thing we need to work on is creating MORE points :) You can see that you have a pretty high accuracy rate.. This means that you know the right stuff, you know what’s valid and relevant, but we just need to get you to trigger MORE of it. This is very different to if, for example, you wrote 20 points down, and only 6 were correct… then it’s obvious that you’re just throwing ANYTHING at the question hoping something is correct. That means you need to go back and improve your understanding of the topic or the question. In your case, that’s all cool… you just need to get better at using your tools. How? (Meh… wait for it!) More questions like this.

The improvements here come from being exposed to more and more different situations and how they work. You know the theory, and studying more theory won’t help you identify more relevant stuff. It’s practice. It’s like baking. The concept of baking is simple… put stuff in a pan, put it in the oven at a hot temperature… BUT, we need practice to learn that sometimes the recipe is wrong about how long it takes because our oven is different, the pan is deeper etc… it’s the repetition, constant baking and adjusting and learning with new recipes and getting a ‘feel’ for the stuff… that’s how we improve. There’s theory… but the only improvement comes from doing :) So, this is really positive for you, because there’s no theory you need to revise… take your theory, those lovely little acronyms, and start looking for areas and how they apply :) Do small questions, and keep doing them (even if they’re CTA questions).

Your communication is great :)`
  ),
  seed(
    "task3diy-volume-accuracy",
    "Task 3 DIY",
    "Volume and accuracy",
    `There are two things we can look at for discussion questions like the strategy questions that can help you identify what to work on:

Volume: Do you have enough points for the marks needed? In this case, you had about 15 points for a 16 mark question, so it’s fine, but would be safer to have about 18 or more… so that if you’re on the wrong track about some stuff, you have a margin for error. So, your volume is fine, but could be ‘safer’.

Accuracy: For however many points you have, what is your accuracy ratio? In your case, you had 15 points and 11 marks. So, you’re able to get most of your points to be accurate. (This could look quite different… if you had 15 points but only 6 marks, that’s an indication that you can’t separate relevant from irrelevant stuff.). In your case, you can clearly see what’s relevant, which is great.

Sometimes we have issues with both volume and accuracy, and sometimes it’s just one of them. Volume is improved by structuring (Task 5) and accuracy is improved through practice and sometimes application (if you’re knowledge dumping) and sometimes it’s communication (you have ‘stuff’, but you’re not saying the right ‘thing’ about them). So… you can see that this is valuable to evaluate. :)`
  ),
  seed(
    "task3diy-strategy",
    "Task 3 DIY",
    "What is strategy",
    `In this question, a lot of students kinda struggle because they’re not actually really sure what strategy REALLY is. What is the actual difference between operations and strategy? Perhaps a little time with ChatGPT may help. The more we can visualise this, the more we can come up with stuff for different questions.`
  ),
  seed(
    "task3diy-cpc",
    "Task 3 DIY",
    "CPC structure",
    `CPC - One of the most valuable parts of this question is the CPC structure, so well done there. Those questions are very common, and generally have generous mark plans. Each CPC issue might have 4 or 5 marks allocated to it, and most students only get two of them… so if you can convert more to marks, you can get great marks for CPC questions and make up for those other questions that you really suck at!

Make sure you work on and practice more CPC questions. And make sure you pay attention to the explanations of the threats that I’ve put in the CPC document in the course.`
  ),
  seed(
    "task4-where-to-start",
    "Task 4",
    "Where do I start the discussion",
    `This is an interesting question in terms of communication. Another little ‘layer’ to our skill. When you’re looking at these types of questions, it is a REALLY good habit to ask yourself “Where do I START my discussion?”. In this case, for the VAT question, you needed to start at the point where you assess whether the contract is an ISA, as opposed to going straight to the VAT stuff.

So, how can we tell? We need to pay attention to whether the case study and required have GIVEN you the treatment, or whether they’ve left that out. So, in this case, they asked you to explain the implications of the CONTRACT… nowhere in the question or case study have they gone through the process of the classification, so the fact that they’re only giving you the transaction without telling you what they recognised it as, is a clue that you’ll need to start your discussion there. This is pretty common, so watch out for it. They may have said in the required “… assuming that it’s been recognised as an ISA…” that means that they’ve gone through the classification process and so you don’t have to.

Think of other questions like this… the difference between saying “Discuss the subsequent measurement of the machine they purchased…” or they may say “Discuss the subsequent measurement of the PPE they acquired”... in the one, they’ve mentioned the ‘thing’, but not the treatment, so in order to discuss the subsequent measurement, you’d first have to identify what it should be classified as. In the second one, they’ve told you it’s PPE, so you can go straight to the discussion of the subsequent measurement. It feels like a ‘sneaky’ detail… but now that you know it’s there, you can actively watch for this in ALL sorts of questions. Have they decided the treatment? Or do I need to do that first?`
  ),
  seed(
    "task4-income-tax",
    "Task 4",
    "Income tax ripple effects",
    `Income Tax… this is a good one to look at and consider for your systematic thinking. This happens quite often so it’s a good lesson for us. The question asked for the tax implications ‘as a result of the lease’... this means that you need to address ALL the stuff that was caused by this lease. What’s the ripple effect of this contract? If you’d stepped back and thought about this, you’d have done way better, because of course you know the related transactions etc. You just didn’t THINK of using them here. So, what we’ve learnt from this, is to ALWAYS ask ourselves in questions whether they’re focussing our attention on JUST this thing, or whether we need to consider the ripple effects. This does happen often, so it’s a really good lesson :)`
  ),
  seed(
    "task5-cpc",
    "Task 5",
    "CPC — move on from the scandal",
    `One of the challenges for students here is that once they see something OBVIOUSLY dodgy, they struggle to see anything else. It’s such a scandal, they focus ONLY on that. You need to deal with it, and move on. Keep the structure and make sure you get marks as you go.`
  ),
  seed(
    "task5-psp",
    "Task 5",
    "Personal Service Provider",
    `I really like this question (yeah, sounds cruel!), it illustrates a REALLY valuable lesson that we need to learn, and highlights the importance of doing more questions than theory. :) The tricky part of this question is NOT that it's a PSP. Most students know SOMETHING about PSP's. BUT... the tricky part here is that most students didn't see it coming. Because there was no hint, no keyword, no label, no flashing neon sign saying "This is a PSP!". We underestimate how much we rely on 'hints' and neon signs to tell us what we're dealing with, instead of interrogating the substance of the situation. This is far closer to the reality of dealing with clients, right? Your client isn't going to come in and say "We have a PSP situation, what's the tax implications?", they're going to assume it's PAYE and just ask you how they should calculate it, because they think they KNOW!

How do we prepare for this? The more exposure we get to situations where we're forced to think more and look closer, the more our brains get used to doing this. It's a skill :) We need to REALISE that stuff can be sitting in front of our faces, but if we only pick it up when there’s a flashing neon sign… we might be in trouble ;) Takes practice.`
  ),
  seed(
    "task5-impairment",
    "Task 5",
    "Impairment & injury — expand and contract",
    `I think the tricky part for the impairment and contingent question is trying to squeeze all the stuff you feel you should say about all this, into a 3 mark question. Sheesh! This is another super-valuable skill to practice.

The ability to expand and contract our communication is critical. If your client has 3 hours available for you to explain something, you’re going to do it REALLY differently than if they have 10 minutes. You won’t include the same things in the discussion. How do you deal with this? The less time you have, the more succinct you have to be… get to the point faster. Make sure you deal with the core issue. If you have more time, you can work through everything in more detail… but shorter questions require more prioritisation and ensuring the core issue is dealt with.`
  ),
  seed(
    "task5extra-stay-calm",
    "Task 5 Extra",
    "Stay calm when it looks horrible",
    `This one is all about staying calm in the face of something that initially looks HORRIBLE. This one went really badly in the exam it was written in, and once you go through the solution, you realise it IS possible and there ARE easy marks, but it does NOT look like it! I’ve added the videos, (which do take some time, I know) to really talk through the thinking and the process of breaking stuff down and remaining calm.

Most students feel like ‘not writing’ is a waste of time… I get that, but you need to consciously remind yourself that when you rush, you get NOTHING. You might end up not having time to write two more points by slowing down… but the ones you DO have are way more likely to be correct.

Remember that you don’t need to be PERFECT at structuring… you just need to be a little better each time. If you’re a bit better, your marks for ALL questions will improve :) It’s great! Well done for doing it :)`
  ),
  seed(
    "task6-gross-income",
    "Task 6",
    "Gross income accrual",
    `The gross income accrual question is an interesting one to learn from. This is like the impairment and injury question in Task 5. Can you get to the core of the issue? Can you spot the ‘thing’ you need to deal with?

Most students kinda answer this as though it’s OBVIOUS that the sale should be included in gross income. It’s a very generic answer, and that alone should trigger some warning signals for you… IAC will not have an ENTIRE question that’s ‘obvious’. :) This is a shorter question that asks you to deal with the inclusion of something in Gross Income, so what you want to do by default, is work through all the criteria that makes this gross income. BUT… it’s only 5 marks, so you don’t have the time to raise and deal with all of this… so, just like in Task 5… you need to prioritise. What’s the CORE of the issue here? And how could you have picked this up?

What info is the case study focussing on? DATES. There are dates all over the show. And not only that… but they’re over the yearend. HMMMMMMMM… suspicious! If this was FinAcc, you’d be thinking of events after balance sheet date. If it was Auditing, you’d be thinking of cut-off. Although this is tax, it’s the same concept :) “When does the transaction ACTUALLY occur?”. They’ve given you a BUNCH of possibilities to choose from. This makes it pretty obvious that they’re aiming at an answer that deals with WHEN to shove this thing in the tax return.

- 23 Feb - sold on credit… but NOT included in taxable income
- 23 Feb - delivered to client, but still in closing stock
- 30 days formal repayment terms
- 1 Mar - bank approves clients’ loan
- Before 10 Mar - client shows SA Solar their successful application

This is exactly the same concept as a provision / contingent liability, where your client is unsure about which date / event to use for the transaction.

When the case study is giving you lots of info relating to one concept of the criteria… this is because THAT’S the CORE issue. The core issue in this question is: WHEN does this transaction get shoved into Gross Income?

You KNOW the concept of ‘unconditionally entitled’, you’ve known it since second year :) but you never actually THOUGHT about what this looks like. You’re used to this being just ‘sending an invoice’. It’s a sale, so it’s ‘unconditionally entitled’. If you simplified this… you’d have visualised this… the sale is only valid IF they can get funding. No funding = no sale.

The core issue of questions is where the risk, the weirdness, the tricky thing is, or possibly… just where there’s more info in the case study for the ‘same’ concept :). There will always be more marks here, because I want to know if you understand how stuff applies in the ‘normal’ stuff, but also the weird stuff. In short questions… we generally ‘skip’ the normal stuff and get straight to the weird stuff. :)`
  ),
  seed(
    "task6-ethics",
    "Task 6",
    "Ethics — who is the person",
    `This is an interesting one that teaches us to pay attention to WHO the person is. Always ask yourself who they are, because this affects the ethical framework you need to apply. In this case, he was a shareholder, but there was no indication he was a director, so the Co Act, King etc doesn’t apply. Definitely not an auditor or CA, so no CPC. He’s a ‘normal’ person, so our general ethics (good for self etc) and obviously normal laws (like the Tax Act). Tax practitioner is a ‘professional’ position. Not the CPC, but some kind of requirement for professional behaviour and belongs to a professional body.`
  ),
  seed(
    "task6-worksheets",
    "Task 6",
    "Worksheet stuff",
    `The value of the worksheets are to try be a little more ‘forensic’ about what it is that’s getting in the way of your marks when you DO questions. WHERE is the problem? And what is the solution? It’s a really good plan to be a little more specific about these things to make sure we know WHERE our time is going and what things are costing us marks.`
  ),
  seed(
    "task6-slow-down",
    "Task 6",
    "Slow down",
    `Ok, so you know you need to slow down, how do we force you to do that? One of the tips I give students is to put your pen on the far end of the desk before you start writing. It will freak you out, because your brain wants to jump in. But, you KNOW how many marks you’re losing because you’re rushing. So, get in the habit of putting your pen away, and only picking it up after you’ve taken three deep breaths and reminded yourself of the fact that in the past, you’ve lost more marks by rushing than thinking.`
  ),
  seed(
    "task2old-process",
    "Task 2 (Old)",
    "The process feels slower",
    `Yup, the process does feel slower, especially to start with. It’s like any change, we take a bit of time to get used to how it works. After 4 questions, it will be a lot faster.

I think it’s increasingly important though. Taking a look at the Jan ’24 case studies, you can see they’re ‘spreading’ out the info a lot more. This means that the same info for one question could be spread out between a bunch of different sections. We HAVE to have some kind of process to categorise this so we can identify all the relevant stuff for the questions. No way that highlighters will work there.

I discussed it in our Live session, and I made another video as well…
https://courses.accountingstudyadvice.com/courses/take/itc-skills-course-june-2024/texts/54696905-nb-why-do-you-need-to-really-focus-on-this

You can see the shift in information presentation and we have to make sure that we’re prepared for it. Planning and visualising the case study is crucial.

I would suggest that with this process, once you’ve marked your question, go back to the case study and look at the following:
- Did you ‘plan’ the stuff in the solution? Was there stuff in the solution that you didn’t see in your reading time?
- Did you plan it and then not use it? This happens when we’re rushed, we DID see it, but somehow missed it and didn’t put it in the answer
- Planned it, but didn’t think it was relevant… was there an alternative note you could’ve made that would’ve helped you more?
- And, very importantly… what areas of the case study did you make NO notes for, and why? It’s very seldom that info is given to you in the case study with NO reason at all… so if it’s not ‘speaking’ to you… why not? What were you supposed to do with it?`
  ),
  seed(
    "task2old-labelling",
    "Task 2 (Old)",
    "Notes that label the info",
    `When I look at your notes, what I’m happy to see is that you’re not trying to predict the question, you’re just labelling the info. “This is ethics stuff” “This is investment info” “This is Mozambique expansion stuff”... The purpose of doing this type of indexing is to categorise info more effectively for your use when you DO get the question. “You asked me about share stuff? Fine, I can go STRAIGHT to the sections that mentioned and gave info about share stuff… even if that was in a bunch of different places in the case study”. And the way you’re doing it will help you with that. :) Your labels will help you find stuff faster and better :) Don’t give up, I PROMISE YOU!`
  ),
  seed(
    "task2old-predicting",
    "Task 2 (Old)",
    "Notes that predicted the question",
    `When I look at your notes, in some cases it feels like you focussed more on trying to predict the question than focus on what the info is SAYING. It’s a little like having your client sit across from you in a meeting, and instead of focussing on the problems and info they’re talking about, you’ve already decided that they want you to do their tax for them, so you’ll focus on ‘tax’ stuff in the chat and you’re not actually paying attention to what they’re saying… then, at the end of the discussion, they ask you to compile the AFS… and you’re in trouble, because you listened with a specific purpose, predicting the question, instead of understanding the info. Perhaps that’s why you mention in your study form that you struggled to figure out what some of the stuff triggers… because you were trying to trigger questions instead of pay attention to what the info was saying? “Share option info” “Revenue increase” “Subsidiary acquisition”. The purpose of doing this type of indexing is to categorise info more effectively for your use when you DO get the question. “You asked me about share stuff? Fine, I can go STRAIGHT to the sections that mentioned and gave info about share stuff… even if that was in a bunch of different places in the case study”. Does that make sense?

As I mentioned, it does take a little longer when we do it the first few times… but the alternative is too scary… losing marks you DESERVE because you can’t find, don’t remember case study info, spend too much time rereading the case study, predicting questions and misreading the question. That’s heartbreaking!`
  ),
  seed(
    "planning-case-study",
    "Planning",
    "Planning the case study",
    `I think you’re on the right track with your planning. I always use timelines as well, so I can keep a visual of what happens and when, and in what order. But I like the fact that you’re ‘indexing’ the info instead of trying to ‘think’ your way through it, when you don’t have the required.

As you do the solution for the next questions you do, I advise you to go back to your planning and ask yourself a few questions:
- Were there things you didn’t see in the case study that you SHOULD’VE indexed? Why didn’t you?
- Were there things that you DID index, but you didn’t actually use them in your answer?
- Why did you leave them out of your answer?
- You didn’t think it was relevant?
- You didn’t see the notes you made?
- You were rushing and didn’t actually USE the planning notes you’d made? You tried to rely on your memory of what the case study said?
- You didn’t know what to do with the info.

All of these questions are valuable to identify different issues that are getting in the way of your marks. In Task 6, we’ll cover this more, as I’ll give you some worksheets to help identify application and communication challenges this way.`
  ),
  seed(
    "planning-rtfq",
    "Planning",
    "RTFQ",
    `It takes a while to learn to consistently interpret each required properly. This is actually really common, and although it feels horrible to realise this, by improving the way you interpret questions, we can improve your marks quite quickly… without other studying. That’s pretty cool! If you’re losing 30% of your marks because you’re misreading the question in some way… then that’s a really easy way to get an extra 30% :)

There are two videos I want you to watch (which you may have seen already… but let’s go back over them in relation to this particular discussion),
- Task 2, L6 - The Power of ‘Thing’
https://courses.accountingstudyadvice.com/courses/take/itc-jan24/texts/50178090-l6-the-power-of-thing
- Task 3, L4 - Types of Discussions
https://courses.accountingstudyadvice.com/courses/take/itc-jan24/texts/50256967-l4-types-of-discussions

These two videos give you practical advice on how to ‘simplify’ the required so that you can properly visualise the underlying requirement, which from your comments, is something that will really help you. One of the challenges we have is that there’s a lot going on in the required, and under time pressure, we’re trying to keep a lot of stuff in our head at once. The question and terminology can be intimidating. Lots of info, long words, lots of terminology and info for a case study we’ve never seen before. So, it’s an overload of info for your brain to make sense of. We can help by breaking down the process for your brain. Simplify the required, so that you can visualise the basic ‘shape’ of the question… and then add the technical stuff back in. This gives you a much more comfortable ability to work with the question and create your answer. As with the planning, it will take a little bit of practice… but sheesh, it’s super valuable to have a specific approach to use when you’re under stress in the exam, to know that you have a process to follow, instead of rushing through and hoping for the best. Along with the ability to structure your answer… you’re developing the skill of breaking tough stuff down into more manageable pieces… which means you can isolate the more basic stuff.`
  ),
  seed(
    "planning-time",
    "Planning",
    "Time management",
    `Time management is a tricky balance. We will NEVER get ALL the stuff done that we want, so we have to play a juggling game between making sure we interpret the question AND the case study info properly (which means slowing down to pay attention) AND then making sure we structure our answer to cover all the components (also slowing down) AND trying to get all the points down that you can… the challenge is that if you rush the question and case study part, you may answer the ‘wrong’ question and get EVERYTHING wrong. And if you rush your planning, you may miss out on an entire component/s of the answer. If you run out of time and lose the ability to write down two points on your answer… that’s only two marks… so we have to decide what will cost us more marks. It’s also about practice. If we’ve done two questions, we’re pretty slow, because our brains are still trying to get used to the process. What do you focus on first? What then? What must you remember about planning? How do you start your sentences? Once you’ve done 5 questions, all this becomes smoother and faster because your brain gets used to the PROCESS. So time management is also a practice thing.

If you’re really struggling with time management… pay attention to WHERE you’re spending the most time… the required? The case study? Planning? Going back to reference books? Trying to figure out how to write the answer? Waffling and having points that are too long? Writing a lot of stuff that doesn’t get marks? Each of these things have different issues, so the more we can identify WHERE your time is going, the better.`
  ),
  seed(
    "grassroots-huge",
    "Grassroots",
    "Stay calm on a huge question",
    `A big part of this one is the idea of staying calm when you see a HUGE question. As you can see, it’s actually quite specifically broken down into smaller questions, but we may miss that if we’re busy freaking out :)

The first one is really about the fact that using structure can help you earn marks even though there’s stuff you really don’t know.

And the second one is about core issues, and really understanding the specific risks associated with info. I want to see whether you ‘get’ that certain situations / events / transactions etc may result in some very specific things, as opposed to raising ‘general’ or even business risks. The procedures here were designed to test whether you just test ‘everything’ like a copy/paste of the textbook, or whether you’re able to specifically test the stuff that you raised as risks. I wanted to see the connection between risk and evidence. Look again at the required… the general procedures are done.

This is quite different from auditing questions you will have done before, in some subtle ways… and I’ve explained the reasoning… so well done for staying calm and getting it done :)`
  ),
  seed(
    "grassroots-bmcr-king",
    "Grassroots",
    "BMCR, RTFQ and King volume",
    `Hi hi

Alrighty, there are a few reasons why this is a valuable task for you :)

First… after all the stuff we did, I’m expecting that you do a BMCR to assess your own answers without me needing to ask for it. You may have done this, I’d be interested to know the results and how you felt about it.

Then… the accounting treatment question…

One of the super-important skills here is the structuring skill, and the RTFQ. Go back and read the required again… the question indicated you should give the implications of both PPE and IP. You started off doing this, and then left it. If you plotted this out, and obviously you can see the markplan, you can see the easy marks available simply by making sure you’re giving the marker what they asked for.

Your communication itself is better. I would say that we need to help you learn to say the right thing in less words. Your stuff reads well, but you’re going to take more time to write each point and we want to get to the point ASAP, so you can get more down. Make note of that, and let’s make sure we deal with that along the way.

King question… In terms of evaluating your answers (whenever you’re doing questions), one of the tools is the concept of ‘volume’ or ‘accuracy’ (check out this video, around 9 minutes
https://courses.accountingstudyadvice.com/courses/take/iac-skills-course-june-2025/texts/63924128-l2-evaluating-your-script)

In your case, you got 4 / 10.. But you only really had 7 points. So, you have a not-so-bad accuracy level, but you don’t have ENOUGH valid points. Either you have ideas that you’re not writing down because you’re doubting yourself; or you ran out of stuff to say; or you ran out of time. Stuff to think of… because it’s clear that you KNOW stuff… but we need MORE stuff. :)`
  ),
  seed(
    "grassroots-risks",
    "Grassroots",
    "Risks missing the why",
    `39 / 75 isn’t bad for this question. It’s a nasty one when you first look at it :)

Be careful though… your risks are dodgy. You have the right concept, but you’re not actually giving me the risk properly. You risk losing marks here because you haven’t communicated them properly.

Take a look at your risks for labour… There are three elements to each risk that you need to communicate:
- Indicator?
- Description of risk?
- Why are you worried?

For most of yours, you have the indicator and description, but you don’t tell me WHY. WHY are you worried that costs will be incorrectly capitalised? If you don’t answer this part properly, you don’t get marks. I need to know that you understand WHY it’s a problem. Otherwise, I could run through the ENTIRE set of AFS and just say “Risk of expensing instead of capitalising” “Risk of calculating incorrectly” “Risk of fraud”... Yes… but WHY are you worried about these? What are you worried will go wrong? You have to explain the WHY.

Most of the ‘why’ comes from these types of things:
- Complexity
- Subjectivity (Estimates; future events; fair values etc)
- Legal issues
- Susceptibility to fraud (cash, inventory, incentives)
- New stuff (never done the project / work / system etc before)
- Material / Significant amounts / issues

These risk factors will help you include the ‘why’.

Your procedures are nicely connected to your risks, which is great. You’re focussing on the specific risks instead of dumping general procedures there. This is great. Your procedures give a much better representation of your understanding of the risks than your risks actually do :)

Note however, you have a volume issue here as well. Most of the points you have, you get marks for… but you need more points. This is a structure issue… figuring out what issues / components you need to deal with before you start, helps trigger the ‘stuff’ you need to include and gets you more points… and which components get more priority. One of the things you kinda left out is the evidence stuff from the ISA’s. The experts, estimates etc. These are valuable marks, and great tools to use to trigger more valid points.

Overall, this is helpful, and it gives us some great stuff to work on. How did you feel about it?`
  ),
  seed(
    "grassroots-core-issue",
    "Grassroots",
    "Core issue and business vs audit risk",
    `This is a nasty one when you first look at it :) Again, the purpose of this is to develop structured thinking, and prioritisation. You started with your planning upfront (calculating the risks and procedures you’d need. Good start).

This is a great exercise in the ‘core issue’ skill. Can you spot the problem? Each of these components have a specific ‘issue’ - either related to IFRS treatment, or issues that create audit vulnerability that requires the ISA evidence chapters. They’re not complicated, but there’s no major signpost that spells them out, which means that most students don’t see it. It’s an indication that the student isn’t thinking about the situation at hand, visualising what’s really happening, focussing on the IFRS and ISA requirements and risks and the implications on the fair presentation. Once you see the markplan, it’s generally more obvious… but the question is why students struggle to get there on their own. Again, this question is nastier than exams, because your procedures and risks are in the same question, which means that if you get the risks wrong, your procedures are also wrong. In exams, they separate this, so that you don’t lose both marks for getting one of them wrong. But for me, I want to see whether students can spot the problem, and whether they can identify the evidence that will address that problem.

Your procedures are fairly well-connected to your risks, and not badly communicated.

Quite a few of your risks are business risks, not audit risks. Perhaps using the assertions as triggers would help? And the more common risk factors:
- Complexity
- Subjectivity (Estimates; future events; fair values etc)
- Legal issues
- Susceptibility to fraud (cash, inventory, incentives)
- New stuff (never done the project / work / system etc before)
- Material / Significant amounts / issues

Overall, this is a great start, and it gives us some great stuff to work on. How did you feel about it?`
  ),
  seed(
    "script-invest-case-study",
    "Script review",
    "Invest in the case study",
    `This is interesting, from your comments, it appears that our biggest focus needs to be on how you absorb the process the info from the case study. Your phrasing of ‘invest in the case study’ is a pretty good way of putting it. :) I do find this quite often, and it can be a result of YEARS of memory studying, where our approach to case studies and questions is to ‘predict’ the question and the answer, so we hunt for keyword triggers, instead of thinking about the info.

A slightly odd piece of advice I give students who struggle with this is to remove yourself from your study environment to shift the way you deal with client info. So, here’s my advice:
- Take a case study, and go to a coffee shop, or somewhere that you absolutely wouldn’t associate with ‘studying’. I like the coffee shop because it has a positive vibe, it feels nice and doesn’t bring back visions of ‘studying’.
- For the case study, personalise the objective. Forget the ‘questions’, and take a bunch of “if this were me” questions with you. Here are a few ideas:
- The client has asked me to be their CFO / Financial Director… would I want to work for them? What challenges would I have? What makes me feel happy about what their finances look like and what makes me nervous?
- I’m considering investing money in this company. What are the pros and cons?
- They’ve asked me for financial advice, what would I advise them?
- They’ve asked me for a loan (if I’m the bank manager), what do I feel about this?
- This is the company I founded. How do I feel about how it’s going, the decisions they’ve made? What would I want to chat to the CFO about in terms of stuff that’s going well and needs fixing?
- If the case study is ‘tax info’ intensive… then take the role of the tax accountant, or even SARS, or again, an investor who may be worried that the company isn’t doing their taxes properly.
- If the case study is audit intensive, you can be either an audit partner considering taking on the client, or the CFO who’s prepping for the audit and considering what will make life easier and what will cause concerns for the auditor that need to be addressed.
- When you’re done… and spend over an hour on one case study… really give it time to sink in… write notes etc… make it an ACTIVE process. THEN take a look at the questions and answers, and see what ‘stuff’ you missed.

It feels a little silly, but we need to personalise the info, and remove your brain from the habit of seeing ‘words’ as theory triggers. We need to activate your ‘thinking’, which you definitely have… but your natural response in exams will definitely be back to memory and triggers, because there’s just no time to ‘think’. But, if we develop the skill of questioning, of LOOKING for red flags, of investing in the client info… the way your brain reads info will change. We need to find the balance between ‘exam prep’ and ‘thinking’... because when I look at your skills, your communication, theory etc are decent… but this concept will definitely get in your way.

Thoughts?`
  ),
];
