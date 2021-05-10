var gl = null
var gl_canvas = null
var program_compute = null
var program_display = null
var color_textures = [null, null]
var position_textures = [null, null] //RGBA32F format and contains X,Y, VX, VY
var framebuffers = [null, null] //both sets of textures are bound to these
var old_state = 0
var new_state = 1
var uniform_render_texture = -1
var uniform_color = -1
var uniform_position = -1

function swap_states() {
    var x = old_state
    old_state = new_state
    new_state = x
}

function page_breaker_load_initial_state(initial_data) {
    var context = initial_data.getContext("2d")
    var image_data = context.getImageData(0,0,gl_canvas.width, gl_canvas.height)

    var width = Math.ceil(gl.canvas.width / 2)
    var height = Math.ceil(gl.canvas.height / 2)

    //do some alterations to this data
    var new_image_data = new Uint8ClampedArray(width * height * 4)
    for(var y = 0; y < height; y++) {
        for(var x = 0; x < width; x++) {
            for(var i = 0; i < 4; i++)
            var index = (y * width + x) * 4 + i
            new_image_data[index] = image_data.data[index]
        }
    }
    console.log(image_data)
    console.log(new_image_data)

    gl.bindTexture(gl.TEXTURE_2D, color_textures[0])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new_image_data)
    gl.bindTexture(gl.TEXTURE_2D, color_textures[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    //at the same time set the position textures to the same size
    gl.bindTexture(gl.TEXTURE_2D, position_textures[0])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, position_textures[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    gl.bindTexture(gl.TEXTURE_2D, null)
}

function page_breaker_create_texture(texture_type="color") {
    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    
    var internal_format = gl.RGBA
    var format = gl.RGBA
    var type = gl.UNSIGNED_BYTE
    var pixel = new Uint8Array([0, 0, 255, 255])
    if(texture_type === "position") {
        internal_format = gl.RGBA32F
        format = gl.RGBA
        type = gl.FLOAT
        pixel = new Float32Array([0, 0, 0, 0])
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, internal_format, 1, 1, 0, format, type, pixel)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
}

function page_breaker_create_framebuffer(color_texture, position_texture) {
    var framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color_texture, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, position_texture, 0)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1])
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return framebuffer
}

function page_breaker_init_data_textures(initial_data) {
    color_textures = [page_breaker_create_texture("color"), page_breaker_create_texture("color")]
    position_textures = [page_breaker_create_texture("position"), page_breaker_create_texture("position")]
    framebuffers = [page_breaker_create_framebuffer(color_textures[0], position_textures[0]), page_breaker_create_framebuffer(color_textures[1], position_textures[1])]

    page_breaker_load_initial_state(initial_data)
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

function execute_program() {
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
    program_display = page_breaker_init_program(
        //VERTEX SHADER
        '#version 300 es\n' +
        'out vec2 uv;' +
        'void main(void) {' +
            'vec2 vertices[3]=vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1, 3));' +
            'gl_Position = vec4(vertices[gl_VertexID],0,1);' +
            'uv = 0.5 * gl_Position.xy + vec2(0.5);' +
        '}',

        
        //FRAGMENT SHADER
        '#version 300 es\n' +
        'in mediump vec2 uv;' +
        'out mediump vec4 out_color;' +
        'uniform sampler2D render_texture;' +
        'void main(void) {' +
            'out_color = texture(render_texture, uv);' +
        '}'
    )

    program_compute = page_breaker_init_program(
        //VERTEX SHADER
        '#version 300 es\n' +
        'out vec2 uv;' +
        'void main(void) {' +
            'vec2 vertices[3]=vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1, 3));' +
            'gl_Position = vec4(vertices[gl_VertexID],0,1);' +
            'uv = 0.5 * gl_Position.xy + vec2(0.5);' +
        '}',


        //FRAGMENT SHADER
        '#version 300 es\n' +
        'in mediump vec2 uv;' +
        'layout(location = 0) out mediump vec4 new_color;' +
        'layout(location = 1) out mediump vec4 new_position;' +
        'uniform sampler2D old_color;' +
        'uniform sampler2D old_position;' +
        'void main(void) {' +
            'new_color = texture(old_color, uv);' +
            'new_position = vec4(0.0, 0.0, 0.0, 0.0);' +
        '}'
    )

    //get uniform locations
    uniform_render_texture = gl.getUniformLocation(program_display, "render_texture")
    uniform_color = gl.getUniformLocation(program_compute, "old_color")
    uniform_position = gl.getUniformLocation(program_compute, "old_position")

    //prepare textures
    page_breaker_init_data_textures(pixel_data)

    //bind textures to units
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, color_textures[0])
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, color_textures[1])
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, position_textures[0])
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, position_textures[1])
}

function page_breaker_update() {
    
    //write uniforms
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[new_state])
    gl.useProgram(program_compute)
    gl.uniform1i(uniform_color, old_state)
    gl.uniform1i(uniform_position, old_state + 2)
    execute_program()

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(program_display)
    gl.uniform1i(uniform_render_texture, new_state)
    execute_program() //render to screen

    swap_states()

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

function page_breaker_view_framebuffer(width, height, framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    var buffer = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer)
    
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
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}