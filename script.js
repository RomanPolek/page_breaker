var gl = null
var gl_canvas = null
var program_display_texture = null
var data_textures = [null, null]

function page_breaker_view_texture(width, height, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture)


    var fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    var buffer = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer)
    console.log(buffer)
    var view_texture_canvas = document.getElementById("page_breaker_view_texture_canvas")
    if(view_texture_canvas == null) {
        view_texture_canvas = document.createElement("canvas")
        view_texture_canvas.id = "page_breaker_view_texture_canvas"
        view_texture_canvas.width = width
        view_texture_canvas.height = height
        view_texture_canvas.style.width = "512px"
        view_texture_canvas.style.height = "512px"
        view_texture_canvas.style.position = "fixed"
        view_texture_canvas.style.top = "50%"
        view_texture_canvas.style.left = "50%"
        view_texture_canvas.style.transform = "translate(-50%, -50%)"
        view_texture_canvas.style.zIndex = "999999"
        view_texture_canvas.style.backgroundColor = "black"
        view_texture_canvas.style.cursor = "pointer"
        view_texture_canvas.onclick = function() {
            this.remove()
        }.bind(view_texture_canvas)

        document.getElementById("page_breaker_overlay").appendChild(view_texture_canvas)
    }
    var context = view_texture_canvas.getContext("2d")
    context.clearRect(0, 0, view_texture_canvas.width, view_texture_canvas.height)
    var image_data = context.createImageData(width, height)
    for(var i = 0; i < buffer.length; i++) {
        image_data.data[i] = buffer[i]
    }
    context.putImageData(image_data, 0, 0)

    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

function page_breaker_create_texture() {
    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    const pixel = new Uint8Array([0, 0, 255, 255])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
}

function page_breaker_init_data_textures() {
    data_textures = [page_breaker_create_texture(), page_breaker_create_texture()]

    var width = Math.round(window.innerWidth)
    var height = Math.round(window.innerHeight / 2 * 3)

    console.log(width)
    console.log(height)

    gl.bindTexture(gl.TEXTURE_2D, data_textures[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)


    gl.bindTexture(gl.TEXTURE_2D, null)



    //TESTING
    gl.bindTexture(gl.TEXTURE_2D, data_textures[0])
    const pixel = new Uint8Array([0, 255, 0, 255])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    page_breaker_view_texture(10,10,data_textures[0])
    
}

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

function execute_program(program) {
    gl.useProgram(program)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function page_breaker_init_gl(canvas, pixel_data) {
    //create context
    gl = canvas.getContext("webgl2")
    gl_canvas = canvas

    page_breaker_resize()
    gl.clearColor(0.8, 0.9, 1.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    //init programs
    program_display_texture = page_breaker_init_program(
        '#version 300 es\n' +
        'out vec2 uv;' +
        'void main(void) {' +
            'vec2 vertices[3]=vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1, 3));' +
            'gl_Position = vec4(vertices[gl_VertexID],0,1);' +
            'uv = 0.5 * gl_Position.xy + vec2(0.5);' +
        '}',

        '#version 300 es\n' +
        'in mediump vec2 uv;' +
        'out mediump vec4 output_color;' +
        'void main(void) {' +
            ' output_color = vec4(uv.x / 3.0,mod(uv.y * uv.x * uv.y, 0.1),mod(uv.x * -uv.y * (uv.y - 10.0), 0.3),1);' +
        '}'
    )

    //prepare textures
    page_breaker_init_data_textures()
}

function page_breaker_update() {
    gl.clear(gl.COLOR_BUFFER_BIT)

    execute_program(program_display_texture)
    requestAnimationFrame(page_breaker_update)
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
        requestAnimationFrame(page_breaker_update)
    })

}

window.addEventListener("resize", page_breaker_resize)