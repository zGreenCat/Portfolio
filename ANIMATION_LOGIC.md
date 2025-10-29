# Lógica de Animación del Portfolio - Explicación Detallada

## 🎯 Objetivo
Crear un efecto de "lectura" donde el texto "Hola! soy Vicente Araya" se revela letra por letra mientras el usuario hace scroll, sincronizado con transiciones de imágenes.

---

## 📂 Arquitectura de Componentes

### 1. **LenisProvider** (`/src/providers/LenisProvider.tsx`)
**Propósito:** Proporciona smooth scroll a toda la aplicación.

```
Flujo:
1. Inicializa Lenis (librería de smooth scroll)
2. Sincroniza Lenis con GSAP usando `lenis.on('scroll', ScrollTrigger.update)`
3. Usa `gsap.ticker` para actualizar Lenis en cada frame
```

**Configuración:**
- `duration: 1.2` - Duración de la inercia del scroll
- `smoothWheel: true` - Suaviza el scroll con mouse wheel
- `gsap.ticker.add()` - Sincroniza con el loop de animación de GSAP

**IMPORTANTE:** Solo usa `gsap.ticker`, NO `requestAnimationFrame` para evitar conflictos.

---

### 2. **SplitLetters** (`/src/components/SplitLetters.tsx`)
**Propósito:** Divide un string en elementos `<span>` individuales para animar cada letra.

```
Entrada: "Hola! soy Vicente Araya"
↓
Proceso: splitTextToChars() → wrapCharsInSpans()
↓
Salida HTML:
<div>
  <span class="letter">H</span>
  <span class="letter">o</span>
  <span class="letter">l</span>
  <span class="letter">a</span>
  <span class="letter">!</span>
  <span class="letter"> </span> (espacio = \u00A0)
  ...
</div>
```

**Callback `onReady`:**
- Se ejecuta cuando todos los spans están creados
- Retorna un array de `HTMLSpanElement[]`
- Permite que el componente padre (IntroSection) configure estilos iniciales

---

### 3. **IntroSection** (`/src/components/IntroSection.tsx`)
**Propósito:** Componente principal con la animación de lectura.

## 🔄 Flujo de Ejecución

### **Paso 1: Inicialización**
```
1. Componente se monta
2. useEffect #1: Detecta prefers-reduced-motion
3. SplitLetters renderiza y divide el texto
4. handleTitleReady() se ejecuta:
   - Guarda referencias a las letras en titleLettersRef.current
   - Establece estilo inicial: color=white, opacity=0.5, display=inline-block
```

### **Paso 2: Configuración de GSAP (después de 100ms)**
```
1. setTimeout espera 100ms (para que Lenis esté listo)
2. gsap.context() crea un contexto aislado
3. Se configuran todas las animaciones ScrollTrigger
```

---

## 🎬 Sistema de Animación ScrollTrigger

### **A. Pin de la Sección (mantiene fija)**
```javascript
ScrollTrigger.create({
  trigger: sectionRef.current,  // <section> del IntroSection
  start: 'top top',              // Cuando el top de la sección toca el top del viewport
  end: '+=5000',                 // 5000px de scroll virtual
  pin: true,                     // Mantiene la sección fija
  pinSpacing: true,              // Añade espacio debajo para scroll
  markers: true                  // DEBUG: muestra marcadores visuales
})
```

**Comportamiento:**
- Cuando llegas al top de la sección → se "pega" (pin)
- Puedes hacer scroll 5000px virtuales mientras la sección está fija
- Después de 5000px → se "despega" y continúa el scroll normal

---

### **B. Animación de Letras (efecto de lectura)**

#### **Configuración Actual:**
```javascript
titleLettersRef.current.forEach((letter, index) => {
  const totalLetters = 23
  const startProgress = (index / totalLetters) * 2000  // 0, 87, 174, ...
  const endProgress = ((index + 1) / totalLetters) * 2000  // 87, 174, 261, ...
  
  gsap.to(letter, {
    opacity: 1,
    scrollTrigger: {
      trigger: sectionRef.current,
      start: `top+=${startProgress} top`,   // Ejemplo: top+=0, top+=87, top+=174
      end: `top+=${endProgress} top`,       // Ejemplo: top+=87, top+=174, top+=261
      scrub: 1                              // Sincroniza con scroll (1 segundo de delay)
    }
  })
})
```

#### **Ejemplo con 3 letras:**
```
Letra H (index=0):
  start: top+=0 top       → opacity 0.5 → 1 entre scroll 0-87px
  end: top+=87 top

Letra o (index=1):
  start: top+=87 top      → opacity 0.5 → 1 entre scroll 87-174px
  end: top+=174 top

Letra l (index=2):
  start: top+=174 top     → opacity 0.5 → 1 entre scroll 174-261px
  end: top+=261 top
```

**Resultado esperado:**
- Scroll 0-2000px: Las letras se van iluminando una por una
- Cada letra anima en ~87px de scroll (2000 / 23 ≈ 87px por letra)

---

### **C. Transición de Imágenes**
```javascript
imageElements.forEach((img, index) => {
  if (index > 0) {
    // Imagen actual: fade in
    gsap.to(img, {
      opacity: 1,
      scrollTrigger: {
        start: `top+=${500 * index} top`,       // 500, 1000, 1500, 2000
        end: `top+=${500 * index + 300} top`,   // 800, 1300, 1800, 2300
        scrub: 1
      }
    })
    
    // Imagen anterior: fade out
    gsap.to(prevImage, {
      opacity: 0,
      scrollTrigger: { /* mismo timing */ }
    })
  }
})
```

**Timeline de imágenes:**
- 0-500px: Solo intro-1.png visible
- 500-800px: Transición intro-1 → intro-2
- 1000-1300px: Transición intro-2 → intro-3
- 1500-1800px: Transición intro-3 → intro-4

---

### **D. Transición a "Sobre mí"**
```javascript
// 2500-3000px: Desaparece "Hola! soy Vicente Araya"
gsap.to('.hero-text-container', {
  opacity: 0,
  y: -30,
  scrollTrigger: {
    start: 'top+=2500 top',
    end: 'top+=3000 top',
    scrub: 1
  }
})

// 3000-3500px: Aparece "Sobre mí"
gsap.to('.about-section-intro', {
  opacity: 1,
  y: 0,
  scrollTrigger: {
    start: 'top+=3000 top',
    end: 'top+=3500 top',
    scrub: 1
  }
})

// 3000-4500px: Letras de "Sobre mí" se revelan
aboutLettersRef.current.forEach((letter, index) => {
  const startProgress = (index / totalLetters) * 1500 + 3000  // 3000-4500
  const endProgress = ((index + 1) / totalLetters) * 1500 + 3000
  
  gsap.to(letter, {
    opacity: 1,
    scrollTrigger: {
      start: `top+=${startProgress} top`,
      end: `top+=${endProgress} top`,
      scrub: 1
    }
  })
})
```

---

## 📊 Timeline Completo del Scroll

```
0px ──────────────────────────────────────────── Pin comienza
│
├─ 0-2000px:    Letras "Hola! soy Vicente Araya" aparecen (0.5 → 1 opacity)
│  ├─ 500px:     Transición imagen 1 → 2
│  ├─ 1000px:    Transición imagen 2 → 3
│  └─ 1500px:    Transición imagen 3 → 4
│
├─ 2500-3000px: Desaparece título principal
│
├─ 3000-3500px: Aparece "Sobre mí" (contenedor)
│
├─ 3000-4500px: Letras "Sobre mí" aparecen (0 → 1 opacity)
│
├─ 4800-5000px: Todo desaparece
│
5000px ────────────────────────────────────────── Pin termina, scroll normal continúa
```

---

## 🐛 Problema Actual: Animación No Funciona

### **Síntomas:**
1. ✅ Texto visible (opacity 0.5, color blanco)
2. ✅ Logs en consola: "Title ready", "Setting up GSAP animations"
3. ✅ ScrollTrigger se crea correctamente
4. ✅ Marcadores verdes/rojos visibles
5. ❌ Al hacer scroll, las letras NO cambian de opacidad

### **Teorías del Problema:**

#### **Teoría 1: Timing Issue**
- **Problema:** ScrollTrigger se crea cuando la sección ya está en `top top`
- **Evidencia:** Console muestra "Pin entered" inmediatamente, `start: -0.001`
- **Causa:** El useEffect se ejecuta cuando la sección ya está visible
- **Solución potencial:** Crear ScrollTriggers ANTES de que la sección sea visible

#### **Teoría 2: Conflicto Lenis - GSAP**
- **Problema:** Lenis modifica el scroll nativo, ScrollTrigger no detecta cambios
- **Evidencia:** Marcadores se mueven pero animaciones no
- **Causa:** `scrub: 1` no está sincronizado con el scroll de Lenis
- **Solución potencial:** 
  - Verificar que `lenis.on('scroll', ScrollTrigger.update)` funciona
  - Probar `scrub: true` en lugar de `scrub: 1`

#### **Teoría 3: Trigger Incorrecto**
- **Problema:** `start: 'top+=${valor} top'` no funciona como esperado con pin
- **Evidencia:** Los marcadores se mueven pero el progreso no actualiza las letras
- **Causa:** Sintaxis incorrecta o conflicto con pinning
- **Solución potencial:**
  - Usar valores absolutos en lugar de relativos
  - Cambiar trigger a otro elemento

#### **Teoría 4: Referencias Perdidas**
- **Problema:** Las referencias a las letras se pierden entre renders
- **Evidencia:** titleLettersRef.current tiene las letras al inicio
- **Causa:** React re-renderiza y pierde referencias
- **Solución potencial:** useCallback o mejores guards

#### **Teoría 5: Scrub No Actualiza Estilos**
- **Problema:** `scrub: 1` no aplica los cambios de opacity
- **Evidencia:** console.log en ScrollTrigger funciona pero estilos no cambian
- **Causa:** GSAP no puede acceder a las propiedades de los spans
- **Solución potencial:**
  - Verificar que los spans tienen inline-block
  - Probar sin `scrub` primero

---

## 🔍 Pasos de Debugging Recomendados

### **1. Verificar que ScrollTrigger detecta el scroll:**
```javascript
scrollTrigger: {
  onUpdate: (self) => console.log('Progress:', self.progress),
  scrub: 1
}
```

### **2. Probar animación simple sin scrub:**
```javascript
gsap.to(titleLettersRef.current, {
  opacity: 1,
  duration: 2,
  stagger: 0.1  // Sin ScrollTrigger
})
```

### **3. Verificar que Lenis actualiza ScrollTrigger:**
```javascript
lenis.on('scroll', (e) => {
  console.log('Lenis scroll:', e.scroll)
  ScrollTrigger.update()
})
```

### **4. Simplificar el trigger:**
```javascript
scrollTrigger: {
  trigger: sectionRef.current,
  start: 'top top',
  end: 'bottom top',
  scrub: true,  // true en lugar de 1
  onUpdate: (self) => {
    titleLettersRef.current.forEach((letter, i) => {
      letter.style.opacity = String(self.progress)
    })
  }
}
```

---

## 📝 Configuración de Estilos Iniciales

### **handleTitleReady():**
```javascript
letters.forEach(letter => {
  letter.style.display = 'inline-block'  // Necesario para GSAP
  letter.style.opacity = '0.5'           // Estado inicial visible
  letter.style.color = 'white'           // Texto blanco
})
```

**¿Por qué opacity 0.5?**
- Para que el texto sea visible desde el inicio
- La animación va de 0.5 → 1.0 (no 0 → 1)
- Efecto visual: texto "fantasma" que se ilumina al leer

---

## 🎨 Estructura HTML Resultante

```html
<section ref={sectionRef} class="h-screen flex items-center px-6 bg-cream">
  <div class="max-w-7xl mx-auto grid grid-cols-2">
    
    <!-- Izquierda: Imágenes -->
    <div class="order-1">
      <div class="intro-shadow" style="opacity: 0"><!-- Sombra 1 --></div>
      <div class="intro-shadow" style="opacity: 0"><!-- Sombra 2 --></div>
      <div class="intro-shadow" style="opacity: 0"><!-- Sombra 3 --></div>
      <div class="intro-shadow" style="opacity: 0"><!-- Sombra 4 --></div>
      
      <div class="intro-image" style="opacity: 1; z-index: 10">
        <img src="/intro/intro-1.png" />
      </div>
      <div class="intro-image" style="opacity: 0; z-index: 5">
        <img src="/intro/intro-2.png" />
      </div>
      <div class="intro-image" style="opacity: 0; z-index: 5">
        <img src="/intro/intro-3.png" />
      </div>
      <div class="intro-image" style="opacity: 0; z-index: 5">
        <img src="/intro/intro-4.png" />
      </div>
    </div>

    <!-- Derecha: Texto -->
    <div class="order-2 relative z-20">
      <div class="hero-text-container">
        <div>
          <span class="letter" style="opacity:0.5; color:white">H</span>
          <span class="letter" style="opacity:0.5; color:white">o</span>
          <span class="letter" style="opacity:0.5; color:white">l</span>
          <span class="letter" style="opacity:0.5; color:white">a</span>
          <span class="letter" style="opacity:0.5; color:white">!</span>
          <!-- ... más letras ... -->
        </div>
      </div>
      
      <div class="about-section-intro" style="opacity: 0">
        <!-- Texto "Sobre mí" -->
      </div>
    </div>
    
  </div>
</section>
```

---

## 🚨 Posible Solución: Usar onUpdate Manual

Si `scrub` no funciona, podemos controlar manualmente:

```javascript
ScrollTrigger.create({
  trigger: sectionRef.current,
  start: 'top top',
  end: '+=2000',
  pin: false,
  onUpdate: (self) => {
    titleLettersRef.current.forEach((letter, index) => {
      const letterProgress = (self.progress * 23) - index
      const opacity = Math.max(0.5, Math.min(1, 0.5 + letterProgress))
      letter.style.opacity = String(opacity)
    })
  }
})
```

Esta approach calcula manualmente la opacity basándose en el progreso del scroll.
