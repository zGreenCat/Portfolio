'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from 'next/image'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const aboutTextRef = useRef<HTMLDivElement>(null)
  const image1Ref = useRef<HTMLDivElement>(null)
  const image2Ref = useRef<HTMLDivElement>(null)
  const image3Ref = useRef<HTMLDivElement>(null)
  const image4Ref = useRef<HTMLDivElement>(null)

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const texts = {
    es: {
      greeting: 'Hola! soy Vicente Araya',
      about: 'Desarrollador full-stack. Me gusta diseñar experiencias web limpias y rápidas, del prototipo al despliegue. Disfruto resolver problemas reales con código y aprender tecnologías nuevas. Estoy abierto a colaborar en proyectos web y productos con impacto.',
      projects: 'Proyectos',
      contact: 'Contacto',
      projectsTitle: 'Proyectos Destacados',
      viewProject: 'Ver Proyecto'
    },
    en: {
      greeting: 'Hello! I am Vicente Araya',
      about: 'A full-stack developer. I enjoy designing clean and fast web experiences, from prototype to deployment. I love solving real problems with code and learning new technologies. I am open to collaborating on web projects and products with impact.',
      projects: 'Projects',
      contact: 'Contact',
      projectsTitle: 'Featured Projects',
      viewProject: 'View Project'
    }
  }

  const projectsData = [
    {
      title: 'E-commerce Platform',
      description: lang === 'es' 
        ? 'Plataforma completa de comercio electrónico con pagos integrados y gestión de inventario.'
        : 'Complete e-commerce platform with integrated payments and inventory management.',
      tags: ['Next.js', 'TypeScript', 'Stripe', 'PostgreSQL'],
      image: '/intro/intro-1.png'
    },
    {
      title: 'Task Management App',
      description: lang === 'es'
        ? 'Aplicación de gestión de tareas con colaboración en tiempo real y notificaciones.'
        : 'Task management application with real-time collaboration and notifications.',
      tags: ['React', 'Node.js', 'WebSocket', 'MongoDB'],
      image: '/intro/intro-2.png'
    },
    {
      title: 'Analytics Dashboard',
      description: lang === 'es'
        ? 'Dashboard interactivo con visualización de datos y reportes personalizados.'
        : 'Interactive dashboard with data visualization and custom reports.',
      tags: ['Vue.js', 'D3.js', 'Express', 'Redis'],
      image: '/intro/intro-3.png'
    },
    {
      title: 'Social Network',
      description: lang === 'es'
        ? 'Red social con sistema de posts, comentarios y mensajería instantánea.'
        : 'Social network with posts, comments and instant messaging system.',
      tags: ['React Native', 'Firebase', 'GraphQL'],
      image: '/intro/intro-4.png'
    }
  ]

  const [currentProject, setCurrentProject] = useState(0)

  useEffect(() => {
    if (!sectionRef.current || !textRef.current || !imageRef.current || !aboutTextRef.current ||
        !image1Ref.current || !image2Ref.current || !image3Ref.current || !image4Ref.current) return

    const text = texts[lang].greeting
    const aboutText = texts[lang].about
    
    // Create letter spans for main text
    const letters = text.split('').map((char) => {
      const span = document.createElement('span')
      span.textContent = char === ' ' ? '\u00A0' : char
      span.style.display = 'inline-block'
      span.style.filter = 'blur(8px)'
      span.style.opacity = '0.4'
      span.style.color = '#4A5E52' // Verde oscuro
      return span
    })

    // Create letter spans for "Sobre mí" text
    const aboutLetters = aboutText.split('').map((char) => {
      const span = document.createElement('span')
      span.textContent = char === ' ' ? '\u00A0' : char
      span.style.display = 'inline-block'
      span.style.filter = 'blur(8px)'
      span.style.opacity = '0'
      span.style.color = '#4A5E52' // Verde oscuro
      return span
    })

    // Add to DOM
    textRef.current.innerHTML = ''
    letters.forEach(letter => textRef.current!.appendChild(letter))
    
    aboutTextRef.current.innerHTML = ''
    aboutLetters.forEach(letter => aboutTextRef.current!.appendChild(letter))

    // Wait for DOM
    const timer = setTimeout(() => {
      console.log('🚀 Iniciando animación')
      
      const ctx = gsap.context(() => {
        // Animate with 3 phases: intro text → fade out → about text
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=5000', // Más largo para 3 fases
          pin: true,
          pinSpacing: true,
          scrub: 1,
          markers: false, // Markers de debug desactivados
          onUpdate: (self) => {
            const progress = self.progress
            console.log(`📊 Progress: ${(progress * 100).toFixed(1)}%`)
            
            // Fase 1: Animar "Hola! soy Vicente Araya" (0 → 0.35)
            const phase1Progress = Math.min(progress / 0.35, 1)
            
            letters.forEach((letter, index) => {
              const letterStart = index / letters.length
              const letterEnd = (index + 1) / letters.length
              
              if (phase1Progress >= letterStart && phase1Progress <= letterEnd) {
                const localProgress = (phase1Progress - letterStart) / (letterEnd - letterStart)
                const blur = 8 - (localProgress * 8)
                const opacity = 0.4 + (localProgress * 0.6)
                
                letter.style.filter = `blur(${blur}px)`
                letter.style.opacity = opacity.toString()
              } else if (phase1Progress > letterEnd) {
                letter.style.filter = 'blur(0px)'
                letter.style.opacity = '1'
              }
            })
            
            // Fase 2: Fade out del texto inicial (0.35 → 0.45)
            if (progress > 0.35 && progress <= 0.45) {
              const fadeProgress = (progress - 0.35) / 0.1
              const fadeOpacity = 1 - fadeProgress
              const fadeBlur = fadeProgress * 8
              
              letters.forEach((letter) => {
                letter.style.opacity = fadeOpacity.toString()
                letter.style.filter = `blur(${fadeBlur}px)`
              })
            } else if (progress > 0.45) {
              // Ocultar completamente
              letters.forEach((letter) => {
                letter.style.opacity = '0'
              })
            }
            
            // Imagen anima durante toda la duración
            const imageScale = 0.8 + (progress * 0.2)
            const imageOpacity = 0.3 + (progress * 0.7)
            
            if (imageRef.current) {
              imageRef.current.style.transform = `scale(${imageScale})`
              imageRef.current.style.opacity = imageOpacity.toString()
            }
            
            // Transición de imágenes con sombras
            // Imagen 1: Siempre visible, se convierte en sombra
            if (image1Ref.current) {
              if (progress < 0.25) {
                image1Ref.current.style.opacity = '1'
                image1Ref.current.style.filter = 'brightness(1) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.4))'
              } else {
                // Se convierte en sombra verde oscura
                image1Ref.current.style.opacity = '0.3'
                image1Ref.current.style.filter = 'brightness(0.5) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.6))'
              }
            }
            
            // Imagen 2: Aparece en 0.25, se vuelve sombra en 0.5
            if (image2Ref.current) {
              if (progress < 0.25) {
                image2Ref.current.style.opacity = '0'
              } else if (progress >= 0.25 && progress < 0.5) {
                const fadeIn = (progress - 0.25) / 0.05
                image2Ref.current.style.opacity = Math.min(fadeIn, 1).toString()
                image2Ref.current.style.filter = 'brightness(1) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.4))'
              } else {
                // Se convierte en sombra
                image2Ref.current.style.opacity = '0.3'
                image2Ref.current.style.filter = 'brightness(0.5) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.6))'
              }
            }
            
            // Imagen 3: Aparece en 0.5, se vuelve sombra en 0.75
            if (image3Ref.current) {
              if (progress < 0.5) {
                image3Ref.current.style.opacity = '0'
              } else if (progress >= 0.5 && progress < 0.75) {
                const fadeIn = (progress - 0.5) / 0.05
                image3Ref.current.style.opacity = Math.min(fadeIn, 1).toString()
                image3Ref.current.style.filter = 'brightness(1) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.4))'
              } else {
                // Se convierte en sombra
                image3Ref.current.style.opacity = '0.3'
                image3Ref.current.style.filter = 'brightness(0.5) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.6))'
              }
            }
            
            // Imagen 4: Aparece en 0.75, se mantiene hasta el final
            if (image4Ref.current) {
              if (progress < 0.75) {
                image4Ref.current.style.opacity = '0'
              } else {
                const fadeIn = (progress - 0.75) / 0.05
                image4Ref.current.style.opacity = Math.min(fadeIn, 1).toString()
                image4Ref.current.style.filter = 'brightness(1) drop-shadow(0 10px 30px rgba(74, 94, 82, 0.4))'
              }
            }
            
            // Fase 3: Animar "Sobre mí" párrafo (0.5 → 1.0)
            if (progress > 0.5) {
              const phase3Progress = (progress - 0.5) / 0.5
              
              aboutLetters.forEach((letter, index) => {
                const letterStart = index / aboutLetters.length
                const letterEnd = (index + 1) / aboutLetters.length
                
                if (phase3Progress >= letterStart && phase3Progress <= letterEnd) {
                  const localProgress = (phase3Progress - letterStart) / (letterEnd - letterStart)
                  const blur = 8 - (localProgress * 8)
                  const opacity = 0.4 + (localProgress * 0.6)
                  
                  letter.style.filter = `blur(${blur}px)`
                  letter.style.opacity = opacity.toString()
                } else if (phase3Progress > letterEnd) {
                  letter.style.filter = 'blur(0px)'
                  letter.style.opacity = '1'
                }
              })
            }
          }
        })
      }, sectionRef)

      return () => {
        clearTimeout(timer)
        ctx.revert()
      }
    }, 100)
  }, [lang])

  return (
    <div className="bg-[#F5F0E6]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F0E6]/80 backdrop-blur-sm border-b border-[#4A5E52]/10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          {/* Navigation Links - Centered */}
          <div className="flex items-center justify-center gap-8">
            <a 
              href="#proyectos" 
              className="text-[#4A5E52] hover:opacity-70 transition-opacity font-light"
            >
              {texts[lang].projects}
            </a>
            <a 
              href="#contacto" 
              className="text-[#4A5E52] hover:opacity-70 transition-opacity font-light"
            >
              {texts[lang].contact}
            </a>
            
            {/* Language Switch */}
            <button
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-2 text-[#4A5E52] hover:opacity-70 transition-opacity font-light"
            >
              <span className={lang === 'es' ? 'opacity-100' : 'opacity-40'}>ES</span>
              <div className="w-10 h-5 bg-[#A9C5A0] rounded-full relative cursor-pointer">
                <div 
                  className="absolute top-0.5 w-4 h-4 bg-[#4A5E52] rounded-full transition-all duration-300"
                  style={{ left: lang === 'es' ? '2px' : '22px' }}
                />
              </div>
              <span className={lang === 'en' ? 'opacity-100' : 'opacity-40'}>EN</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        ref={sectionRef}
        className="h-screen flex flex-col items-center justify-center gap-8 px-16 bg-[#F5F0E6]"
      >
        {/* Contenedor principal - imagen y texto principal */}
        <div className="flex items-center justify-center gap-12 w-full max-w-6xl">
          {/* Imagen a la izquierda - Stack de 4 imágenes */}
          <div 
            ref={imageRef}
            className="flex justify-end"
            style={{
              transform: 'scale(0.8)',
              opacity: 0.3,
              transition: 'none'
            }}
          >
            <div className="relative w-[350px] h-[450px]">
              {/* Imagen 1 - Base */}
              <div 
                ref={image1Ref}
                className="absolute inset-0"
                style={{ transition: 'opacity 0.3s, filter 0.3s' }}
              >
                <Image
                  src="/intro/intro-1.png"
                  alt="Vicente Araya 1"
                  fill
                  className="object-cover rounded-lg"
                  priority
                />
              </div>
              
              {/* Imagen 2 */}
              <div 
                ref={image2Ref}
                className="absolute inset-0"
                style={{ opacity: 0, transition: 'opacity 0.3s, filter 0.3s' }}
              >
                <Image
                  src="/intro/intro-2.png"
                  alt="Vicente Araya 2"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              
              {/* Imagen 3 */}
              <div 
                ref={image3Ref}
                className="absolute inset-0"
                style={{ opacity: 0, transition: 'opacity 0.3s, filter 0.3s' }}
              >
                <Image
                  src="/intro/intro-3.png"
                  alt="Vicente Araya 3"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              
              {/* Imagen 4 - Final */}
              <div 
                ref={image4Ref}
                className="absolute inset-0"
                style={{ opacity: 0, transition: 'opacity 0.3s, filter 0.3s' }}
              >
                <Image
                  src="/intro/intro-4.png"
                  alt="Vicente Araya 4"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Textos a la derecha - En el mismo contenedor */}
          <div className="flex-1 flex items-center relative">
            {/* Texto inicial "Hola! soy Vicente Araya" */}
            <h1 
              ref={textRef}
              className="text-6xl font-light w-full"
            />
            
            {/* Texto "Sobre mí" - Aparece en el mismo lugar */}
            <p 
              ref={aboutTextRef}
              className="text-3xl font-light leading-relaxed w-full absolute top-1/2 -translate-y-1/2 pr-8"
            />
          </div>
        </div>
      </div>
      
      {/* Projects Section */}
      <section id="proyectos" className="min-h-screen bg-[#F5F0E6] py-20 px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Title */}
          <h2 className="text-5xl font-light text-[#4A5E52] text-center mb-16">
            {texts[lang].projectsTitle}
          </h2>

          {/* Carousel Container */}
          <div className="relative">
            {/* Cards Container */}
            <div className="flex gap-8 overflow-hidden">
              {projectsData.map((project, index) => (
                <div
                  key={index}
                  className="min-w-[400px] bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-500 hover:shadow-2xl"
                  style={{
                    transform: `translateX(-${currentProject * 432}px)`,
                    transition: 'transform 0.5s ease-in-out'
                  }}
                >
                  {/* Project Image */}
                  <div className="relative h-64 bg-[#A9C5A0]/20">
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Project Info */}
                  <div className="p-8">
                    <h3 className="text-2xl font-light text-[#4A5E52] mb-4">
                      {project.title}
                    </h3>
                    <p className="text-[#4A5E52]/70 mb-6 leading-relaxed">
                      {project.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {project.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-[#A9C5A0]/30 text-[#4A5E52] rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* View Project Button */}
                    <button className="w-full py-3 bg-[#4A5E52] text-white rounded-lg hover:bg-[#4A5E52]/90 transition-colors font-light">
                      {texts[lang].viewProject} →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={() => setCurrentProject(Math.max(0, currentProject - 1))}
              disabled={currentProject === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-[#4A5E52] hover:bg-[#A9C5A0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentProject(Math.min(projectsData.length - 1, currentProject + 1))}
              disabled={currentProject === projectsData.length - 1}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-[#4A5E52] hover:bg-[#A9C5A0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-8">
              {projectsData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentProject(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentProject 
                      ? 'bg-[#4A5E52] w-8' 
                      : 'bg-[#A9C5A0]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Spacer para tener contenido después del scroll */}
      <div className="h-[200vh] bg-[#A9C5A0] flex items-center justify-center">
        <p className="text-4xl text-white">Contenido después de la animación</p>
      </div>
    </div>
  )
}
