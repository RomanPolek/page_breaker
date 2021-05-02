gl = null
gl_canvas = null

function page_breaker_resize() {
    if(gl_canvas != null) {
        gl_canvas.width = window.innerWidth
        gl_canvas.height = window.innerHeight
        gl_canvas.style.width = window.innerWidth + "px"
        gl_canvas.style.height = window.innerHeight + "px"
    }
    if(gl != null) {
        gl.viewport(0, 0, gl_canvas.width, gl_canvas.height)     
    }
}

function page_breaker_renderer_compilation_log(shader) {
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    console.log('Shader compiled successfully: ' + compiled);
    var compilationLog = gl.getShaderInfoLog(shader);
    if(compilationLog != "") {
        console.log('Shader compiler log: ' + compilationLog);
    }
}

function page_breaker_init_program(vertex_code, fragment_code) {
    let vertext_shader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertext_shader, vertex_code)
    gl.compileShader(vertext_shader)
    page_breaker_renderer_compilation_log(vertext_shader)

    let fragment_shader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragment_shader, fragment_code)
    gl.compileShader(fragment_shader)
    page_breaker_renderer_compilation_log(fragment_shader)

    let shader_program = gl.createProgram()
    gl.attachShader(shader_program, vertext_shader)
    gl.attachShader(shader_program, fragment_shader)
    gl.linkProgram(shader_program)
    return shader_program
}

function page_breaker_init_gl(canvas, pixel_data) {
    //create context
    gl = canvas.getContext("webgl2")
    gl_canvas = canvas

    page_breaker_resize()
    gl.clearColor(0.8, 0.9, 1.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    //init programs
    page_breaker_init_program(
    '#version 300 es\n' +
    'in vec2 vertices;' +
    'in vec3 colors;' +
    'uniform mat4 matrix;' +
    'uniform vec3 position[512];' +
    'uniform vec2 scale[512];' +
    'uniform float rotation[512];' +
    'uniform vec4 colorOffset[512];' +
    'out lowp vec4 offsetColor;' +
    'out lowp vec3 trueColor;' +
    'void main(void) {' +
        'vec2 p = vec2(vertices.x * scale[gl_InstanceID].x, vertices.y * scale[gl_InstanceID].y);' + 
        'trueColor = colors;' +
        'offsetColor = colorOffset[gl_InstanceID];' +
        'gl_Position = vec4(p.x * cos(rotation[gl_InstanceID]) + p.y * sin(rotation[gl_InstanceID]) + position[gl_InstanceID].x, p.y * cos(rotation[gl_InstanceID]) - p.x * sin(rotation[gl_InstanceID]) + position[gl_InstanceID].y, position[gl_InstanceID].z, 1.0) * matrix;' +
    '}',

    '#version 300 es\n' +
    'in lowp vec4 offsetColor;' +
    'in lowp vec3 trueColor;' +
    'out lowp vec4 outputColor;' +
    'void main(void) {' +
        ' outputColor = vec4(trueColor.x + offsetColor.x, trueColor.y + offsetColor.y, trueColor.z + offsetColor.z, offsetColor.w);' +
    '}'
    )
}

function break_page() {
    console.log("breaking page")

    var overlay = document.getElementById("page_breaker_overlay")
    if(overlay == null) {
        overlay = document.createElement("div")
        overlay.setAttribute("data-html2canvas-ignore", "true")
        overlay.id = "page_breaker_overlay"
        overlay.style.position = "fixed"
        overlay.style.top = "0px"
        overlay.style.left = "0px"
        overlay.style.zIndex= "999"
        

        //create close button
        var close_button = document.createElement("p")
        close_button.onclick = () => {overlay.remove()}
        close_button.innerHTML = "X"
        close_button.style.cursor = "pointer"
        close_button.style.fontFamily = "Arial"
        close_button.style.padding = "10px"
        close_button.style.margin = "20px"
        close_button.style.fontSize = "2em"
        close_button.style.color = "white"
        close_button.style.borderRadius = "800px"
        close_button.style.backgroundColor = "brown"
        close_button.style.display = "inline-block"
        close_button.style.width = "30px"
        close_button.style.height = "30px"
        close_button.style.textAlign = "center"
        close_button.style.position = "fixed"
        close_button.style.top = "0px"
        close_button.style.right = "0px"
        close_button.style.zIndex= "999"
        overlay.appendChild(close_button)

        document.body.appendChild(overlay)
    }


    var canvas = document.getElementById("page_breaker_canvas")
    if(canvas != null) {
        canvas.remove()
    }
    
    html2canvas(document.body).then((pixel_data) => {
        var canvas = document.createElement("canvas")
        canvas.id="page_breaker_canvas"
        overlay.appendChild(canvas)
        page_breaker_init_gl(canvas, pixel_data)
    })

}

window.addEventListener("resize", page_breaker_resize)