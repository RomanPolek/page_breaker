var running = false
var gl = null
var gl_canvas = null
var program_compute = null
var program_output = null
var program_display = null
var color_textures = [null, null]
var position_textures = [null, null] //RGBA32F format and contains X,Y, VX, VY
var output_color_texture = null
var reference_texture = null
var framebuffers = [null, null] //both sets of textures are bound to these
var output_framebuffer = null
var clear_framebuffer = null
var old_state = 0
var new_state = 1
var uniform_render_color = -1
var uniform_render_position = -1
var uniform_render_width = -1
var uniform_render_height = -1
var uniform_color = -1
var uniform_position = -1
var uniform_delta_time = -1
var uniform_output_sampler = -1
var uniform_display_screen_width = -1
var uniform_reference = -1
var uniform_width = -1
var uniform_height = -1
var scaling_factor = 1 //is a natural number. 1 is maximum quality
var width = 0
var height = 0
var previous_time = -1

function swap_states() {
    var x = old_state
    old_state = new_state
    new_state = x
}

function page_breaker_load_initial_state(initial_data) {
    width = Math.ceil(gl.canvas.width / scaling_factor)
    height = Math.ceil(gl.canvas.height / scaling_factor)

    var context = initial_data.getContext("2d")
    var image_data = context.getImageData(0,0,gl_canvas.width, gl_canvas.height)

    //do some alterations to this data
    var new_image_data = new Uint8ClampedArray(width * height * 4)
    for(var y = 0; y < height; y++) {
        for(var x = 0; x < width; x++) {
            for(var i = 0; i < 4; i++){
                var destination_index = (y * width + x) * 4 + i
                var source_index = ((gl_canvas.height - y*scaling_factor) * gl_canvas.width + x*scaling_factor) * 4 + i
                new_image_data[destination_index] = image_data.data[source_index]
            }
        }
    }

    gl.bindTexture(gl.TEXTURE_2D, color_textures[old_state])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new_image_data)
    gl.bindTexture(gl.TEXTURE_2D, color_textures[new_state])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    //at the same time set the position textures to the same size
    //generate the initial positions from 0,0 to 1,1
    //it also contains the velocities
    var initial_positions = new Float32Array(width * height * 4)
    for(var y = 0; y < height; y++) {
        for(var x = 0; x < width; x++) {
            var index = (y * width + x) * 4
            initial_positions[index + 0] = x / width //X coord
            initial_positions[index + 1] = y / height //Y coord
            initial_positions[index + 2] = 0 //VX
            initial_positions[index + 3] = 0 //VY
        }
    }

    gl.bindTexture(gl.TEXTURE_2D, position_textures[old_state])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, width, height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, new Uint32Array(initial_positions.buffer))
    gl.bindTexture(gl.TEXTURE_2D, position_textures[new_state])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, width, height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null)

    //init reference textures
    gl.bindTexture(gl.TEXTURE_2D, output_color_texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, reference_texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)


    gl.bindTexture(gl.TEXTURE_2D, null)
}

function page_breaker_create_texture(texture_type="color", filtering="nearest") {
    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    var filter = filtering === "nearest"? gl.NEAREST : gl.LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    
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

function page_breaker_create_framebuffer(color_texture, position_texture = null) {
    var framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color_texture, 0)
    if(position_texture != null) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, position_texture, 0)
        gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1])
    }
    else {
        gl.drawBuffers([gl.COLOR_ATTACHMENT0])
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return framebuffer
}

function page_breaker_init_data_textures(initial_data) {
    color_textures = [page_breaker_create_texture("color"), page_breaker_create_texture("color")]
    position_textures = [page_breaker_create_texture("position"), page_breaker_create_texture("position")]
    output_color_texture = page_breaker_create_texture("color")
    reference_texture = page_breaker_create_texture("position")

    framebuffers = [page_breaker_create_framebuffer(color_textures[0], position_textures[0]), page_breaker_create_framebuffer(color_textures[1], position_textures[1])]
    output_framebuffer = page_breaker_create_framebuffer(output_color_texture, reference_texture)
    clear_framebuffer = page_breaker_create_framebuffer(output_color_texture)

    page_breaker_load_initial_state(initial_data)
}

function page_breaker_resize() {
    if(gl_canvas != null) {
        gl_canvas.width = window.innerWidth
        gl_canvas.height = window.innerHeight
        gl_canvas.style.width = window.innerWidth + "px"
        gl_canvas.style.height = window.innerHeight + "px"
    }
}

function page_breaker_renderer_compilation_log(shader) {
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    console.log('Shader compiled successfully: ' + compiled);
    var compilationLog = gl.getShaderInfoLog(shader);
    if(compilationLog != "") {
        console.log('Shader compiler log: ' + compilationLog);
        gl = "" //stops the blinking
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
    gl.clearColor(1.0, 1.0, 1.0, 0.0)
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
        'out mediump vec4 output_color;' +
        'uniform sampler2D output_sampler;' +
        'uniform uint display_screen_width;' +
        'void main(void) {' +
            'output_color = texture(output_sampler, uv);' +
            'if(output_color.w == 0.0) {' +
                'output_color = texture(output_sampler, uv + 1.0/float(display_screen_width));' +
            '}' +
        '}'
    )


    program_output = page_breaker_init_program(
        //VERTEX SHADER
        '#version 300 es\n' +
        'out vec4 color;' +
        'out vec2 uv;' +
        'uniform sampler2D render_color;' +
        'uniform highp usampler2D render_position;' +
        'uniform highp float render_width;' +
        'uniform highp float render_height;' +
        'void main(void) {' +
            'uv = vec2(mod(float(gl_VertexID), render_width), float(gl_VertexID) / render_width);' +
            'uv /= vec2(render_width, render_height);' +
            'highp vec2 pos = uintBitsToFloat(texture(render_position, uv).xy);' +
            'color = texture(render_color, uv);' +
            'gl_Position = vec4(pos * 2.0 - 1.0, 0, 1);' +
            'gl_PointSize = 1.0;'+
        '}',

        
        //FRAGMENT SHADER
        '#version 300 es\n' +
        'in highp vec4 color;' +
        'in highp vec2 uv;' +
        'layout(location = 0) out highp vec4 out_color;' +
        'layout(location = 1) out highp vec4 reference;' +
        'void main(void) {' +
            'out_color = vec4(color.xyz, 1.0);' +
            'reference = vec4(uv, fract(uv * 256.0));' +
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
        'in highp vec2 uv;' +
        'uniform sampler2D old_color;' +
        'uniform highp usampler2D old_position;' +
        'uniform highp sampler2D reference;' +
        'uniform highp float delta_time;' +
        'uniform highp uint width;' +
        'uniform highp uint height;' +
        'layout(location = 0) out highp vec4 new_color;' +
        'layout(location = 1) out highp vec4 new_position;' +

        'const highp float SCENE_WIDTH = 2000.0;' +
        'const highp float SCENE_HEIGHT = 2000.0;' +
        'const highp float GRAVITY = 9.81;' +
        'const highp float SIDE_COEFFICIENT_OF_RESTITUTION = 0.10;' +
        'const highp int COLLISION_DETECTION_RANGE = 5;' +
        'const highp float COLLISION_REPEL_RADIUS = 2.0;' +
        'const highp float COLLISION_REPEL_STRENGTH = 1.0;' +
        'void main(void) {' +
            'highp vec4 world_transformation = vec4(SCENE_WIDTH, SCENE_HEIGHT, SCENE_WIDTH, SCENE_HEIGHT);' +

            'new_color = texture(old_color, uv);' +
            'highp vec4 old_pos = uintBitsToFloat(texture(old_position, uv));' +
            'highp vec2 old_coordinates = old_pos.xy;' +
            'old_pos *= world_transformation;' +
            
            'highp vec4 change = vec4(0, 0, 0, -GRAVITY*0.0);' +

            //collisions
            'for(int y = -COLLISION_DETECTION_RANGE; y <= COLLISION_DETECTION_RANGE; y++) {' +
                'for(int x = -COLLISION_DETECTION_RANGE; x <= COLLISION_DETECTION_RANGE; x++) {' +
                    'if(!(x==0 && y == 0)) {' +
                        'highp vec2 coords = old_coordinates + vec2(x, y) / vec2(width, height);' +
                        'highp vec4 raw_reference = texture(reference, coords);' +
                        'highp vec2 reference_coords = raw_reference.xy + raw_reference.zw / 256.0;' +
                        'highp vec4 other_position = uintBitsToFloat(texture(old_position, reference_coords)) * world_transformation;' +
                        'highp vec2 direction_vector = other_position.xy - old_pos.xy;' +
                        'highp float point_distance = length(direction_vector);' +
                        'if(point_distance <= COLLISION_REPEL_RADIUS) {' +
                            'change.zw += -1.0 * direction_vector * COLLISION_REPEL_STRENGTH;' +
                        '}' +
                    '}' +
                '}' +
            '}' +

            'new_position = (old_pos + vec4(old_pos.z, old_pos.w, 0, 0) + change * delta_time);' +


            //side collisions
            'if(new_position.x < 0.0) {' +
                'new_position.x = -new_position.x;' +
                'new_position.z *= -SIDE_COEFFICIENT_OF_RESTITUTION;' +
            '}' +
            'if(new_position.y < 0.0) {' +
                'new_position.y = -new_position.y;' +
                'new_position.w *= -SIDE_COEFFICIENT_OF_RESTITUTION;' +
            '}' +
            'if(new_position.x > SCENE_WIDTH) {' +
                'new_position.x = 2.0 * SCENE_WIDTH - new_position.x;' +
                'new_position.z *= -SIDE_COEFFICIENT_OF_RESTITUTION;' +
            '}' +
            'if(new_position.y > SCENE_WIDTH) {' +
                'new_position.y = 2.0 * SCENE_WIDTH - new_position.y;' +
                'new_position.w *= -SIDE_COEFFICIENT_OF_RESTITUTION;' +
            '}' +
            'new_position /= world_transformation;' +
        '}'
    )

    //get uniform locations
    uniform_display_screen_width = gl.getUniformLocation(program_display, "display_screen_width")
    uniform_output_sampler = gl.getUniformLocation(program_display, "output_sampler")
    uniform_render_color = gl.getUniformLocation(program_output, "render_color")
    uniform_render_position = gl.getUniformLocation(program_output, "render_position")
    uniform_render_width = gl.getUniformLocation(program_output, "render_width")
    uniform_render_height = gl.getUniformLocation(program_output, "render_height")
    uniform_color = gl.getUniformLocation(program_compute, "old_color")
    uniform_position = gl.getUniformLocation(program_compute, "old_position")
    uniform_delta_time = gl.getUniformLocation(program_compute, "delta_time")
    uniform_reference = gl.getUniformLocation(program_compute, "reference")
    uniform_width = gl.getUniformLocation(program_compute, "width")
    uniform_height = gl.getUniformLocation(program_compute, "height")
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
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, output_color_texture)
    gl.activeTexture(gl.TEXTURE5)
    gl.bindTexture(gl.TEXTURE_2D, reference_texture)
}

function page_breaker_update(time) {
    if(previous_time == -1) previous_time = time
    var delta_time = (time - previous_time) / 1000
    previous_time = time

    //write uniforms
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[new_state])
    gl.viewport(0, 0, width, height)
    gl.useProgram(program_compute)
    gl.uniform1i(uniform_color, old_state)
    gl.uniform1i(uniform_position, old_state + 2)
    gl.uniform1i(uniform_reference, 5)
    gl.uniform1f(uniform_delta_time, delta_time)
    gl.uniform1ui(uniform_width, width)
    gl.uniform1ui(uniform_height, height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.bindFramebuffer(gl.FRAMEBUFFER, clear_framebuffer)
    gl.viewport(0, 0, width, height)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindFramebuffer(gl.FRAMEBUFFER, output_framebuffer)
    gl.viewport(0, 0, width, height)
    gl.useProgram(program_output)
    gl.uniform1i(uniform_render_color, new_state)
    gl.uniform1i(uniform_render_position, new_state + 2)
    gl.uniform1f(uniform_render_width, width)
    gl.uniform1f(uniform_render_height, height)
    gl.drawArrays(gl.POINTS, 0, width * height)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl_canvas.width, gl_canvas.height)
    gl.useProgram(program_display)
    gl.uniform1i(uniform_output_sampler, 4)
    gl.uniform1ui(uniform_display_screen_width, width)
    gl.drawArrays(gl.TRIANGLES, 0, 4)
    
    swap_states()

    if(running)
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
        overlay.style.backgroundColor = "rgb(220,220,220)"

        //create close button
        var close_button = document.createElement("p")
        close_button.onclick = () => {overlay.remove(); running = false; previous_time = -1}
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
        running = true
        previous_time = -1
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