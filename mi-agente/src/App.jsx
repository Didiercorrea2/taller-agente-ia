import { useEffect, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SYSTEM_INSTRUCTION = `
Eres ElectroTutor IA, un profesor virtual especializado en electrónica,
programación, automatización e inteligencia artificial.

Tu objetivo es enseñar al estudiante y no limitarte a entregar respuestas.

- Explica de forma clara y concisa.
- Da pistas cuando sea apropiado.
- Haz preguntas cortas para comprobar el aprendizaje.
- Cuando el estudiante aprenda algo importante, indica:
  "Mira lo que hemos aprendido:".
- Si demuestra suficiente conocimiento, puedes otorgar simbólicamente
  un Diploma ElectroTutor.

COMANDO "Regaño:":
Si el usuario comienza un mensaje con "Regaño:", interpreta lo siguiente
como una corrección sobre tu comportamiento y aplica esa mejora.

COMANDO "implementado:":
Si el usuario comienza con "implementado:", considera lo posterior como
una característica o código que ya existe en su proyecto y tenlo en cuenta
en las siguientes respuestas.

Responde utilizando Markdown cuando sea conveniente.
`;

function App() {
  const [mensajes, setMensajes] = useState(() => {
    const guardados = localStorage.getItem("electrotutor-chat");
    return guardados ? JSON.parse(guardados) : [];
  });

  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    localStorage.setItem("electrotutor-chat", JSON.stringify(mensajes));
  }, [mensajes]);

  const enviarPregunta = async (e) => {
    e.preventDefault();

    if (!pregunta.trim() || cargando) return;

    const textoUsuario = pregunta.trim();

    const mensajeUsuario = {
      rol: "usuario",
      texto: textoUsuario,
    };

    setMensajes((anteriores) => [...anteriores, mensajeUsuario]);
    setPregunta("");
    setCargando(true);

    try {
      const historial = mensajes
        .slice(-10)
        .map(
          (mensaje) =>
            `${mensaje.rol === "usuario" ? "Estudiante" : "ElectroTutor"}: ${
              mensaje.texto
            }`
        )
        .join("\n");

      const entrada = `
Historial reciente:
${historial}

Estudiante: ${textoUsuario}
`;

      const respuestaGemini = await ai.interactions.create({
        model: "gemini-3.7-flash",
        input: entrada,
        system_instruction: SYSTEM_INSTRUCTION,
      });

      const respuesta = respuestaGemini.output_text;

      const mensajeIA = {
        rol: "asistente",
        texto: respuesta,
      };

      setMensajes((anteriores) => [...anteriores, mensajeIA]);

      const { error } = await supabase.from("conversaciones").insert({
        pregunta: textoUsuario,
        respuesta: respuesta,
      });

      if (error) {
        console.error("Error guardando en Supabase:", error);
      }
    } catch (error) {
      console.error(error);

      setMensajes((anteriores) => [
        ...anteriores,
        {
          rol: "asistente",
          texto:
            "⚠️ Ocurrió un error al comunicarme con Gemini. Revisa la consola.",
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const nuevoChat = () => {
    setMensajes([]);
    localStorage.removeItem("electrotutor-chat");
  };

  const copiarRespuesta = async (texto) => {
    await navigator.clipboard.writeText(texto);
  };

  const activarMicrofono = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no admite reconocimiento de voz.");
      return;
    }

    const reconocimiento = new SpeechRecognition();

    reconocimiento.lang = "es-CO";
    reconocimiento.interimResults = false;

    reconocimiento.onresult = (evento) => {
      const texto = evento.results[0][0].transcript;
      setPregunta(texto);
    };

    reconocimiento.start();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>ElectroTutor IA</h2>

        <button onClick={nuevoChat} className="nuevo-chat">
          + Nuevo Chat
        </button>

        <div className="historial">
          <h3>Historial</h3>

          {mensajes
            .filter((mensaje) => mensaje.rol === "usuario")
            .map((mensaje, index) => (
              <div className="historial-item" key={index}>
                {mensaje.texto}
              </div>
            ))}
        </div>
      </aside>

      <main className="chat">
        <div className="chat-header">
          <h1>ElectroTutor IA</h1>
          <p>Tu profesor virtual de ingeniería</p>
        </div>

        <div className="mensajes">
          {mensajes.length === 0 && (
            <div className="bienvenida">
              <h2>¿Qué quieres aprender hoy?</h2>
              <p>
                Pregúntame sobre electrónica, programación, automatización o
                inteligencia artificial.
              </p>
            </div>
          )}

          {mensajes.map((mensaje, index) => (
            <div
              key={index}
              className={`mensaje ${
                mensaje.rol === "usuario" ? "usuario" : "asistente"
              }`}
            >
              <div className="mensaje-contenido">
                {mensaje.rol === "asistente" ? (
                  <>
                    <ReactMarkdown>{mensaje.texto}</ReactMarkdown>

                    <button
                      className="copiar"
                      onClick={() => copiarRespuesta(mensaje.texto)}
                    >
                      Copiar
                    </button>
                  </>
                ) : (
                  mensaje.texto
                )}
              </div>
            </div>
          ))}

          {cargando && (
            <div className="mensaje asistente">
              <div className="mensaje-contenido">Pensando...</div>
            </div>
          )}
        </div>

        <form className="entrada" onSubmit={enviarPregunta}>
          <button
            type="button"
            className="microfono"
            onClick={activarMicrofono}
          >
            🎤
          </button>

          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Escribe tu pregunta..."
          />

          <button type="submit" disabled={cargando}>
            Enviar
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;