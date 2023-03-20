import {defs, tiny} from './examples/common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene, hex_color} = tiny;
const {Cube, Axis_Arrows, Textured_Phong, Phong_Shader, Basic_Shader, Subdivision_Sphere, Triangle} = defs

import {Shape_From_File} from './examples/obj-file-demo.js'
import {Color_Phong_Shader, Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, Buffered_Texture, LIGHT_DEPTH_TEX_SIZE} from './examples/shadow-demo-shaders.js'



// The scene
export class Base_Scene extends Scene {
    constructor() {
        super();
        // Load the model file:
        this.shapes = {
            "sphere": new Subdivision_Sphere(4),
            "cube": new Cube(),
            "light": new Subdivision_Sphere(4),
            "triangle": new Triangle(),
            square: new defs.Square(),
        };

        // *** Materials
        this.materials = {
            white: new Material(new defs.Basic_Shader()),
            plastic: new Material(new defs.Phong_Shader(),
                {ambient: 0, diffusivity: 1,specularity:0, color: hex_color("#ffffff")}),
            water: new Material(new defs.Phong_Shader(),
                                {ambient: .1, diffusivity: .2, specularity:0,color: vec4(0,0,1,.5)  }),
            light:new Material(new defs.Phong_Shader(),
                              {ambient: 1, diffusivity:0, specularity:0, color:hex_color("#FFFF00")}),
            // For light source
            light_src: new Material(new Phong_Shader(), {
              color: hex_color("#FFFF00"), ambient: 1, diffusivity: 0, specularity: 0
            }),
                   
            pure: new Material(new Color_Phong_Shader(), {}),
            cubemap: new Material(new Env_Mapping_Shader(), {ambient: 1, diffusivity:0, specularity:0, skybox: this.skybox, alpha: 0.9}),
            reflect_right: new Material(new Reflect_Texture_Right(), {ambient: 1, diffusivity:0, specularity:0, texture: null}),
            reflect_left: new Material(new Reflect_Texture_Left(), {ambient: 1, diffusivity:0, specularity:0, texture: null}),
            reflect_bottom: new Material(new Reflect_Texture_Bottom(), {ambient: 1, diffusivity:0, specularity:0, texture: null}),
            reflect_top: new Material(new Reflect_Texture_Top(), {ambient: 1, diffusivity:0, specularity:0, texture: null}),
            reflect_front: new Material(new Reflect_Texture_Front(), {ambient: 1, diffusivity:0, specularity:0, texture: null}),
            reflect_back: new Material(new Reflect_Texture_Back(), {ambient: 1, diffusivity:0, specularity:0, texture: null})
        };

        // Materials to use before final pass of generating the cubemap -- first pass shaders use stationary cameras
        this.materials_pass = {
            white: new Material(new Basic_First_Pass()),
            plastic: new Material(new First_Pass_Shader(),
                {ambient: 0, diffusivity: 1,specularity:0, color: hex_color("#ffffff")}),
            water: new Material(new Phong_Shader(),
                {ambient: .1, diffusivity: .2, specularity:0,color: vec4(0,0,1,.5)  }),
            light:new Material(new First_Pass_Shader(),
                {ambient: 1, diffusivity:0, specularity:0, color:hex_color("#FFFF00")}),
            light_src: new Material(new First_Pass_Shader(), {
              color: hex_color("#FFFF00"), ambient: 1, diffusivity: 0, specularity: 0
            })
        }

        // For the floor or other plain objects
        this.floor = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(1, 1, 1, 1), ambient: .3, diffusivity: 0.6, specularity: 0.4, smoothness: 64,
            color_texture: null,
            light_depth_texture: null});
        this.pure= new Material(new Color_Phong_Shader(), {});


        this.init = false;

        this.get_time = false;
        this.moving = true;
        this.final_position = 0;
        this.first_time = 0;
        this.density = 1;

        this.get_sphere_time = false;
        this.sphere_moving = true;
        this.sphere_final = 0;
        this.sphere_time = 0;
        this.sphere_density = 1;

        this.lightX = 1;
        this.light_intensity = 1;

        this.block_splash_animation = false;
        this.first_block_splash = -1;

        this.sphere_splash_animation = false;
        this.first_sphere_splash = -1;
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Increase Block Density", ["i"], () => {

            this.density += .1;


        });
        this.key_triggered_button("Decrease Block Density", ["u"], () => {

            this.density -= .1;

        });
        this.key_triggered_button("Move light left", ["l"], () => {
            this.lightX -= .5;
            if(this.lightX==0)
            {
                this.lightX -= .1;
            }
        });
        this.key_triggered_button("Move light right", ["r"], () => {
            this.lightX += .5;
            if(this.lightX==0)
            {
                this.lightX += .1;
            }
        });
        this.key_triggered_button("Increase Light Intensity", ["n"], () => {
            if (this.light_intensity < 1) {
                this.light_intensity += .1;
            }

        });
        this.key_triggered_button("Decrease Light Intensity", ["m"], () => {
            if (this.light_intensity > 0) {
                this.light_intensity -= .1;
            }

        });
        // Add a button for controlling the scene.
        this.key_triggered_button("Drop Block", ["b"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.create_block = true;
            this.get_time = true;
            this.moving = true;
            this.block_splash_animation = false;
            this.first_block_splash = -1;

        });

        this.key_triggered_button("Drop Sphere", ["h"], () => {
            this.create_sphere = true;
            this.get_sphere_time = true;
            this.sphere_moving = true;
            this.sphere_splash_animation = false;
            this.first_sphere_splash = -1;
        });

        this.key_triggered_button("Increase Sphere Density", ["is"], () => {

            this.sphere_density += .1;


        });

        this.key_triggered_button("Decrease Sphere Density", ["ds"], () => {

            this.sphere_density -= .1;


        });
    }

}

export class FinalAssignment extends Base_Scene {

    texture_buffer_init(gl) {
        // Depth Texture
        this.lightDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);
        this.floor.light_depth_texture = this.light_depth_texture
        this.materials.water.light_depth_texture = this.light_depth_texture
        this.materials_pass.water.light_depth_texture = this.light_depth_texture

        this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
        gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT, // internal format
            this.lightDepthTextureSize,   // width
            this.lightDepthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.UNSIGNED_INT,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth Texture Buffer
        this.lightDepthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            this.lightDepthTexture,         // texture
            0);                   // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // create a color texture of the same size as the depth texture
        // see article why this is needed_
        this.unusedTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.lightDepthTextureSize,
            this.lightDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.unusedTexture,         // texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    reflect_texture_buffer_init(gl, face) {
        // Renders scene to a 2D texture
        let texture = face.tex;
        let framebuffer = face.tex_fb;
        let depthRenderBuffer = face.depth_rb;
        let i = face.i;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        this.size = 512;
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.RGB, // internal format
            this.size,   // width
            this.size,   // height
            0,                  // border
            gl.RGB, // format
            gl.UNSIGNED_BYTE,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.size, this.size);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);

        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,        // texture target
            texture,         // texture
            0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    cube_texture_buffer_init(context, program_state, faces) {
        // Initializes a cubemap texture
        let gl = context.context;
        this.size = 512;

        this.skybox = gl.createTexture();
        // gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skybox);

        for (let i = 0; i < 6; i++) {
            gl.texImage2D(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,      // target
                0,                  // mip level
                gl.RGB, // internal format
                this.size,   // width
                this.size,   // height
                0,                  // border
                gl.RGB, // format
                gl.UNSIGNED_BYTE,    // type
                null);              // data
        }

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    splash_block(context, program_state,t)
    {
        let time_diff=t-this.first_block_splash;
        let splash_factor_y = Math.sin(2*time_diff) * 3;
        let splash_factor_x = time_diff * 3 * this.density;
        if(time_diff>1.5)
        {
            this.block_splash_animation=false;
        }
        let splash_transform1 = Mat4.identity().times(Mat4.translation(-.5,14,0))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(-splash_factor_x-1.5,splash_factor_y,0));
        let splash_transform2 = Mat4.identity().times(Mat4.translation(.5,14,0))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(splash_factor_x+1.5,splash_factor_y,0));
        let splash_transform3 = Mat4.identity().times(Mat4.translation(0,14,.5))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(0,splash_factor_y,splash_factor_x+1.5));
        let splash_transform4 = Mat4.identity().times(Mat4.translation(0,14,-.5))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(0,splash_factor_y,-splash_factor_x-1.5));

        this.shapes.triangle.draw(context, program_state, splash_transform1,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform2,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform3,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform4,this.mats.water);


    }

    splash_sphere(context, program_state, t)
    {
        let time_diff=t-this.first_sphere_splash;
        let splash_factor_y = Math.sin(2*time_diff) * 3;
        let splash_factor_x = time_diff * 3 * this.sphere_density;
        if(time_diff>1.5)
        {
            this.sphere_splash_animation=false;
        }
        let splash_transform1 = Mat4.identity().times(Mat4.translation(-10.5,14,0))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(-splash_factor_x-1.5,splash_factor_y,0));
        let splash_transform2 = Mat4.identity().times(Mat4.translation(-9.5,14,0))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(splash_factor_x+1.5,splash_factor_y,0));
        let splash_transform3 = Mat4.identity().times(Mat4.translation(-10,14,.5))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(0,splash_factor_y,splash_factor_x+1.5));
        let splash_transform4 = Mat4.identity().times(Mat4.translation(-10,14,-.5))
            .times(Mat4.scale(.5,.5,.5))
            .times(Mat4.translation(0,splash_factor_y,-splash_factor_x-1.5));

        this.shapes.triangle.draw(context, program_state, splash_transform1,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform2,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform3,this.mats.water);
        this.shapes.triangle.draw(context, program_state, splash_transform4,this.mats.water);
    }

    drop_block(context, program_state,t, shadow_pass)
    {
        let block_transform=Mat4.identity().times(Mat4.translation(0,20,0));

        if(this.get_time)
        {
            this.first_time=t;
            this.get_time=false;
        }
        let time_diff=t-this.first_time;
        if(this.moving)
        {
            this.final_position=.5*-9.8*(time_diff**2);
        }

        block_transform=block_transform.times(Mat4.translation(0,this.final_position,0));
        let stop_position=-10*this.density;

        if(stop_position<-15.5)
        {
            stop_position=-15.5;
        }
        if(stop_position>-5.5)
        {
            stop_position=-5.5;
        }
        if(time_diff>.95 && time_diff<1.1)
        {
            this.block_splash_animation=true;
            this.first_block_splash=t;
        }
        if(this.final_position<stop_position)
        {
            this.moving=false;
        }
        if(!this.moving) //going to animate the block floating
        {
            let goUp=1;
            if(Math.floor(time_diff)%2==0)
            {
                goUp=-1;
            }
            block_transform=block_transform.times(Mat4.translation(0,.3*Math.sin(time_diff),0));
        }
        this.shapes.cube.draw(context, program_state, block_transform,shadow_pass? this.floor.override({color:hex_color("#FF0000")}) : this.pure);
    }

    drop_sphere(context, program_state,t, shadow_pass)
    {
        let sphere_transform=Mat4.identity().times(Mat4.translation(-10,20,0));

        if(this.get_sphere_time)
        {
            this.sphere_time=t;
            this.get_sphere_time=false;
        }
        let time_diff=t-this.sphere_time;
        if(this.sphere_moving)
        {
            this.sphere_final=.5*-9.8*(time_diff**2);
        }
        sphere_transform=sphere_transform.times(Mat4.translation(0,this.sphere_final,0));
        let top_of_water=-5;
        let stop_position=-10*this.sphere_density;

        if(stop_position<-15.5)
        {
            stop_position=-15.5;
        }
        if(stop_position>-5.5)
        {
            stop_position=-5.5;
        }
        if(time_diff>.95 && time_diff<1.1 )
        {
            this.sphere_splash_animation=true;
            this.first_sphere_splash=t;
        }
        if(this.sphere_final<stop_position)
        {
            this.sphere_moving=false;
        }
        if(!this.sphere_moving) //going to animate the block floating
        {
            let goUp=1;
            if(Math.floor(time_diff)%2==0)
            {
                goUp=-1;
            }
 
            sphere_transform=sphere_transform.times(Mat4.translation(0,.3*Math.sin(time_diff),0));
        }
        this.shapes.sphere.draw(context, program_state, sphere_transform,shadow_pass? this.floor.override({color:hex_color("#00FF00")}) : this.pure);
          
    }

    make_tank_and_light(context, program_state, shadow_pass)
    {
        //Make light bulb
        /*let light_pos = vec4(this.lightX, 22, 0, 1);
        program_state.lights.push(new Light(light_pos, hex_color("#FFFFB3"), 1000));
        let light_transform = Mat4.identity().times(Mat4.translation(light_pos[0], light_pos[1], light_pos[2]));
        this.shapes.light.draw(context,program_state,light_transform,this.mats.light.override({color:color(this.light_intensity,this.light_intensity,0,1)}));
        let light_hang_transform = Mat4.identity().times(Mat4.translation(light_pos[0], light_pos[1], light_pos[2]))
            .times(Mat4.translation(0,10.5,0))
            .times(Mat4.scale(1,10,1));

        this.shapes.cube.draw(context, program_state, light_hang_transform,this.mats.plastic.override({color:hex_color("#FFFFFF")}));
        */


        let tank_transform=Mat4.identity().times(Mat4.scale(15,8,8))

            .times(Mat4.translation(-.3,1.3,0));
        let tank_floor_transform = Mat4.identity().times(Mat4.scale(15,.01,8))
            .times(Mat4.translation(-.3,240,0));
        let tank_left_transform = Mat4.identity().times(Mat4.translation(-19.5,10.4,0))
            .times(Mat4.scale(.01,8,8));
        let tank_right_transform = Mat4.identity().times(Mat4.translation(10.5,10.4,0))
            .times(Mat4.scale(.01,8,8));
        let tank_back_transform = Mat4.identity().times(Mat4.translation(-4.5,10.4,-8))
            .times(Mat4.scale(15,8,.01));
        //tank layout

        //this.shapes.outline.draw(context, program_state, tank_transform, this.mats.white, "LINES");
        this.shapes.cube.draw(context, program_state, tank_floor_transform,shadow_pass? this.floor.override({color:hex_color("#FFFFFF")}) : this.pure);
        this.shapes.cube.draw(context, program_state, tank_left_transform,shadow_pass? this.floor.override({color:hex_color("#808080")}) : this.pure);
        this.shapes.cube.draw(context, program_state, tank_right_transform,shadow_pass? this.floor.override({color:hex_color("#808080")}) : this.pure);
        this.shapes.cube.draw(context, program_state, tank_back_transform,shadow_pass? this.floor.override({color:hex_color("#808080")}) : this.pure);

    }

    make_scene(context, program_state, shadow_pass) {
        let scene_floor_transform = Mat4.identity().times(Mat4.translation(-.45, -5, 0))
            .times(Mat4.scale(40, .01, 60));
        let scene_roof_transform = Mat4.identity().times(Mat4.translation(-.45, 40, 0))
            .times(Mat4.scale(40, .01, 60));
        let scene_back_transform = Mat4.identity().times(Mat4.translation(-.45, 15, -50))
            .times(Mat4.scale(40, 25, .01));
        let scene_front_transform = Mat4.identity().times(Mat4.translation(-.45, 15, 50))
            .times(Mat4.scale(40, 25, .01));
        let scene_left_transform = Mat4.identity().times(Mat4.translation(-40, 15, 0))
            .times(Mat4.scale(.01, 25, 60));
        let scene_right_transform = Mat4.identity().times(Mat4.translation(40, 15, 0))
            .times(Mat4.scale(.01, 25, 60));

        this.shapes.cube.draw(context, program_state, scene_floor_transform, shadow_pass ? this.floor.override({color: hex_color("#FFFDD0")}) : this.pure);
        this.shapes.cube.draw(context, program_state, scene_roof_transform, shadow_pass ? this.floor.override({color: hex_color("#FFFDD0")}) : this.pure);
        this.shapes.cube.draw(context, program_state, scene_back_transform, shadow_pass ? this.floor.override({color: hex_color("#00008B")}) : this.pure);
        this.shapes.cube.draw(context, program_state, scene_front_transform, shadow_pass ? this.floor.override({color: hex_color("#00008B")}) : this.pure);
        this.shapes.cube.draw(context, program_state, scene_left_transform, shadow_pass ? this.floor.override({color: hex_color("#ADD8E6")}) : this.pure);
        this.shapes.cube.draw(context, program_state, scene_right_transform, shadow_pass ? this.floor.override({color: hex_color("#ADD8E6")}) : this.pure);

        //make table
        let table_top_transform = Mat4.identity().times(Mat4.scale(15, .5, 8))
            .times(Mat4.translation(-.3, 3.8, 0));
        let table_BLLeg_transform = Mat4.identity().times(Mat4.scale(1, 3, 1))
            .times(Mat4.translation(-18.5, -.5, -7));
        let table_BRLeg_transform = Mat4.identity().times(Mat4.scale(1, 3, 1))
            .times(Mat4.translation(9.5, -.5, -7));
        let table_FLLeg_transform = Mat4.identity().times(Mat4.scale(1, 3, 1))
            .times(Mat4.translation(-18.5, -.5, 7));
        let table_FRLeg_transform = Mat4.identity().times(Mat4.scale(1, 3, 1))
            .times(Mat4.translation(9.5, -.5, 7));

        this.shapes.cube.draw(context, program_state, table_top_transform, shadow_pass ? this.floor.override({color: hex_color("#964B00")}) :  this.pure);
        this.shapes.cube.draw(context, program_state, table_BLLeg_transform, shadow_pass ? this.floor.override({color: hex_color("#5C4033")}) : this.pure);
        this.shapes.cube.draw(context, program_state, table_BRLeg_transform, shadow_pass ? this.floor.override({color: hex_color("#5C4033")}) : this.pure);
        this.shapes.cube.draw(context, program_state, table_FLLeg_transform, shadow_pass ? this.floor.override({color: hex_color("#5C4033")}) : this.pure);
        this.shapes.cube.draw(context, program_state, table_FRLeg_transform, shadow_pass ? this.floor.override({color: hex_color("#5C4033")}) : this.pure);

    }

    render_scene(context, program_state, shadow_pass, draw_light_source=false, draw_shadow=false) {
        // shadow_pass: true if this is the second pass that draw the shadow.
        // draw_light_source: true if we want to draw the light source.
        // draw_shadow: true if we want to draw the shadow

        let light_position = this.light_position;
        let light_color = this.light_color;
        const t = program_state.animation_time / 1000;

        program_state.draw_shadow = draw_shadow;

        if (draw_light_source && shadow_pass) {
            this.shapes.sphere.draw(context, program_state,
                Mat4.translation(light_position[0], light_position[1], light_position[2]).times(Mat4.scale(.5,.5,.5)),
                this.mats.light_src.override({color: light_color}));
        }


        this.make_tank_and_light(context, program_state, shadow_pass);
        this.make_scene(context, program_state, shadow_pass);


        if(this.sphere_splash_animation)
        {
            this.splash_sphere(context, program_state,t);

        }

        if(this.create_sphere)
        {

            this.drop_sphere(context, program_state,t, shadow_pass);

        }

        
        if(this.block_splash_animation)
        {
            this.splash_block(context, program_state, t);

        }

        if(this.create_block)
        {

            this.drop_block(context, program_state, t, shadow_pass);
        }

        if (this.last_pass && !this.renderTextures) {
                this.shapes.sphere.draw(context, program_state, Mat4.translation(this.sphere_pos[0],this.sphere_pos[1],this.sphere_pos[2])
                    .times(Mat4.scale(4, 4, 4)), this.materials.cubemap);
        }
        let water_transform = Mat4.scale(15,8,8)
            .times(Mat4.translation(-.3,1.05,0))
            .times(Mat4.scale(1,.75,1));

        if (this.last_pass) {
            this.materials.water.transparent= this.materials_pass.water.transparent = true;
            this.shapes.cube.draw(context, program_state, water_transform,this.mats.water);
        }
    }


    display(context, program_state) {
        const t = this.t = program_state.animation_time / 1000;
        const gl = context.context;
        if (!this.init) {
            const ext = gl.getExtension('WEBGL_depth_texture');
            if (!ext) {
                return alert('need WEBGL_depth_texture');  // eslint-disable-line
            }

            this.texture_buffer_init(gl);
            // Buffer information and camera angles needed for each face of environment cube
            // Note that buffers are only used when rendered as individual 2D textures rather than a cubemap
            let x = -5;
            let y = 8;
            let z = 0;
            this.sphere_pos = vec3(x, y, z);
            this.cube_faces = {
                "right": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x-1, y, z), vec3(0, 1, 0)), 5),
                "left": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x+1, y, z), vec3(0, 1, 0)), 6),
                "bottom": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x + 0.01, y-1, z), vec3(0, 0, 1)), 7),
                "top": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x + 0.01, y+1, z), vec3(0, 0, -1)), 8),
                "back": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x + 0.01, y, z-1), vec3(0, 1, 0)), 9),
                "front": new Cube_Face(gl.createTexture(), gl.createFramebuffer(), gl.createRenderbuffer(),
                    Mat4.look_at(vec3(x, y, z), vec3(x + 0.01, y, z+1), vec3(0, 1, 0)), 10),
            };

            // If binding to individual textures
            this.renderTextures = false;    // For debugging
            if (this.renderTextures) {
                for (let face in this.cube_faces) {
                    this.reflect_texture_buffer_init(gl, this.cube_faces[face]);
                }
            } else {
                this.cube_texture_buffer_init(context, program_state, this.cube_faces);
            }

            this.init = !this.init;
        }
         if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.translation(5, -15, -35)); // Locate the camera here
        }
        this.last_pass = false;
        this.mats = this.materials_pass;    // keep track of which shaders to use
        let cam_proj_mat = Mat4.perspective(Math.PI / 2, 1.0, 0.5, 500);
        program_state.proj_transform = cam_proj_mat;


        // The position of the light
        this.light_position = vec4(this.lightX, 22, 0, 1);
        // The color of the light
        this.light_color = color(this.light_intensity,this.light_intensity,this.light_intensity,1);

        // This is a rough target of the light.
        // Although the light is point light, we need a target to set the POV of the light
        this.light_view_target = vec4(0, 0, 0, 1);
        this.light_field_of_view = 130 * Math.PI / 180; // 130 degree

        program_state.lights = [new Light(this.light_position, this.light_color, 10000**this.light_intensity-1)];

        // SHADOW RENDERING
        // Step 1: set the perspective and camera to the POV of light
        const light_view_mat = Mat4.look_at(
            vec3(this.light_position[0], this.light_position[1], this.light_position[2]),
            vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
            vec3(0, 1, 0), // assume the light to target will have a up dir of +y, maybe need to change according to your case
        );
        const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 500);
        // Bind the Depth Texture Buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Prepare uniforms
        program_state.light_view_mat = light_view_mat;
        program_state.light_proj_mat = light_proj_mat;
        program_state.light_tex_mat = light_proj_mat;
        program_state.view_mat = light_view_mat;
        program_state.projection_transform = light_proj_mat;
        this.render_scene(context, program_state, false,false, false);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = cam_proj_mat;


        // ENVIRONMENT MAP RENDERING
        // Render texture to all faces
        gl.viewport(0, 0, this.size, this.size);

        // If binding to individual textures
        if (this.renderTextures) {
            for (let face in this.cube_faces) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.cube_faces[face].tex_fb);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                program_state.view_mat = this.cube_faces[face].cam;
                program_state.proj_transform = cam_proj_mat;

                this.render_scene(context, program_state, true,true, true);
            }
        } else {
            // Visit every necessary camera angle and bind to faces of cubemap
            let framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

            let depthRenderBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.size, this.size);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);

            gl.viewport(0, 0, this.size, this.size);
              
            let i = 0;
            for (let face in this.cube_faces) {

                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,       // target
                    gl.COLOR_ATTACHMENT0,  // attachment point
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,        // texture target
                    this.skybox,         // texture
                    0);

                program_state.view_mat = this.cube_faces[face].cam;
                program_state.proj_transform = cam_proj_mat;

                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                this.render_scene(context, program_state, true,true, true);
                i++;
            }
        }

        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // return to normal camera
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.5, 500);
        this.last_pass = true;
        this.mats = this.materials;

        this.render_scene(context, program_state, true,true, true);

        // To check face textures (rn doesn't work if also bound to cubemap)
        if (this.renderTextures) {
            let square_trans = Mat4.identity().times(Mat4.translation(-14,15,10))
                .times(Mat4.scale(3,3, context.height / 100));
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_left);
            square_trans = (Mat4.translation(6, 0, 0)).times(square_trans);
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_front);
            square_trans = (Mat4.translation(0, -6, 0)).times(square_trans);
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_bottom);
            square_trans = (Mat4.translation(0, 12, 0)).times(square_trans);
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_top);
            square_trans = (Mat4.translation(6, -6, 0)).times(square_trans);
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_right);
            square_trans = (Mat4.translation(6, 0, 0)).times(square_trans);
            this.shapes.square.draw(context, program_state, square_trans, this.materials.reflect_back);
        }
    }
}                          

class Env_Mapping_Shader extends defs.Phong_Shader {
    // Shaders for using an environment map
    // Referenced shaders from https://learnopengl.com/Advanced-OpenGL/Cubemaps
    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                  } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
                uniform samplerCube skybox;
                uniform float alpha;
        
                void main(){         
                    vec3 I = normalize(camera_center - vertex_worldspace);
                    vec3 R = reflect(I, N);
                                                                      
                    gl_FragColor = vec4(textureCube(skybox, R).xyz, 1.0);
                  } `;
    }
}

class Texture_Cube extends tiny.Graphics_Card_Object {
    // **Texture_Cube** wraps a pointer to new texture images where
    // it is stored in GPU memory, along with new HTML image objects.
    // This class initially copies the images to the GPU buffers,
    // optionally generating mip maps of it and storing them there too.
    //
    // Instead of a filename, it takes an array of filenames
    // Only used for loading a skybox from images
    constructor(filenames, min_filter = "LINEAR_MIPMAP_LINEAR") {
        super();
        Object.assign(this, {filenames, min_filter});
        this.images = Array.apply(null, Array(filenames.length));

        for (let i = 0; i < filenames.length; i++) {
            // Create a new HTML Image object:
            this.images[i] = new Image();
            this.images[i].onload = () => this.ready = true;
            this.images[i].crossOrigin = "Anonymous";           // Avoid a browser warning.
            this.images[i].src = filenames[i];
        }
    }

    copy_onto_graphics_card(context, need_initial_settings = true) {
        // copy_onto_graphics_card():  Called automatically as needed to load the
        // texture image onto one of your GPU contexts for its first time.

        // Define what this object should store in each new WebGL Context:
        const initial_gpu_representation = {texture_buffer_pointer: undefined};
        // Our object might need to register to multiple GPU contexts in the case of
        // multiple drawing areas.  If this is a new GPU context for this object,
        // copy the object to the GPU.  Otherwise, this object already has been
        // copied over, so get a pointer to the existing instance.
        const gpu_instance = super.copy_onto_graphics_card(context, initial_gpu_representation);

        if (!gpu_instance.texture_buffer_pointer) gpu_instance.texture_buffer_pointer = context.createTexture();

        const gl = context;
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, gpu_instance.texture_buffer_pointer);

        if (need_initial_settings) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        for (let i = 0; i < this.images.length; i++) {
            gl.texImage2D(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,      // target
                0,                  // mip level
                gl.RGB, // internal format
                gl.RGB, // format
                gl.UNSIGNED_BYTE,    // type
                this.images[i]);              // data
        }

        return gpu_instance;
    }

    activate(context, texture_unit = 0) {
        // activate(): Selects this Texture in GPU memory so the next shape draws using it.
        // Optionally select a texture unit in case you're using a shader with many samplers.
        // Terminate draw requests until the image file is actually loaded over the network:
        if (!this.ready)
            return;
        const gpu_instance = super.activate(context);
        context.activeTexture(context["TEXTURE" + texture_unit]);
        context.bindTexture(context.TEXTURE_CUBE_MAP, gpu_instance.texture_buffer_pointer);
    }
}

// All "Reflect_Texture" shaders are used for binding camera angles to individual textures
class Reflect_Texture_Right extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 5);

    }
}

class Reflect_Texture_Left extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 6);
    }
}

class Reflect_Texture_Bottom extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 7);
    }
}

class Reflect_Texture_Top extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 8);
    }
}

class Reflect_Texture_Front extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 9);
    }
}

class Reflect_Texture_Back extends defs.Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        // Updated for assignment 4
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        context.uniform1i(gpu_addresses.texture, 10);
    }
}

class First_Pass_Shader extends defs.Phong_Shader {
    // Shader for all passes to bind textures to cubemap
    // Same as normal Phong Shader, but uses static camera
    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                  } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
                uniform sampler2D light_depth_texture;
                uniform mat4 light_view_mat;
                uniform mat4 light_proj_mat;    
                
                void main(){                                                           
                    // Compute an initial (ambient) color:
                    gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                    // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                  } `;
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.proj_transform.times(gpu_state.view_mat).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));


        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Basic_First_Pass extends defs.Basic_Shader {
    // Shader for all passes to bind textures to cubemap, uses static camera
    // For cube outline
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.view_mat, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }
}

class Shadow_Textured_Phong_Shader_Pass extends Shadow_Textured_Phong_Shader {
    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.proj_transform.times(gpu_state.view_mat).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
        // shadow related
        gl.uniformMatrix4fv(gpu.light_view_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_view_mat.transposed()));
        gl.uniformMatrix4fv(gpu.light_proj_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_proj_mat.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }
}

class Cube_Face {
    // Cube_Face object contains all the buffer, camera, and texture number needed for individual binding and rendering
    constructor(tex, fb, db, cam, i) {
        this.tex = tex;
        this.tex_fb = fb;
        this.depth_rb = db;
        this.cam = cam;
        this.i = i;
    }
}

