
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import { Modal } from "../src/ui/kit.jsx";
import UnitPlayer, { ListeningAudio } from "../src/app/player.jsx";
import Quest from "../src/app/quest.jsx";
const listeningUnit = { id: "test", title: "Listening practice", language: "en", blocks: [
 { type: "listening", title: "Listen and complete", lang: "en-GB",
 parts: ["First sentence ", ". Second sentence ", "."],
 speak: "First sentence one. Second sentence two.", gap_speech: ["First sentence one.", "Second sentence two."] }
]};
const contextUnit = {id:"context",title:"Reading practice",language:"en",blocks:[
 {type:"text",title:"Read the situation",body:"Maya booked a train for Friday at six. She needs to meet her cousin at the station."},
 {type:"choice",title:"Read and choose",questions:[{q:"Where should they meet?",options:["At the station","At the airport"]}]}
]};
const unit = new URLSearchParams(location.search).has("context") ? contextUnit : listeningUnit;
const check = async () => ({ blocks: { "0": { gaps: [true, true], gap_answers: ["one", "two"] } }, score: 2, total: 2 });
function Harness() {
 const [quest, setQuest] = useState(false);
 const [open, setOpen] = useState(true);
 const file = new URLSearchParams(location.search).has("audio");
 return <div className="animate-fadeup p-5">
  {file ? <ListeningAudio b={{ audio: "/qa-audio.wav", audio_start: 0.2, audio_end: 0.6 }} /> :
  <><Modal open={open && !quest} onClose={() => setOpen(false)} title="Lesson preview" lesson>
    <button className="btn-brand mb-4" onClick={() => setQuest(true)}>Пройти как ученик</button>
    <UnitPlayer unit={unit} onSubmit={check} />
   </Modal>
   {quest && <Quest unit={unit} onCheck={check} onSubmit={check} onExit={() => setQuest(false)} />}</>}
 </div>;
}
createRoot(document.getElementById("root")).render(<Harness />);
