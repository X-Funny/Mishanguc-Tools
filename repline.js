importPackage(Packages.com.sk89q.worldedit);
importPackage(Packages.com.sk89q.worldedit.math);
importPackage(Packages.com.sk89q.worldedit.blocks);

(function() { 
    var blocks = context.remember();
    var player = context.getPlayer();

    // --- 参数解析 ---
    var type = argv[1];
    var gapLen = (argv[2] !== undefined) ? parseInt(argv[2]) : 0;  // 空格长
    var dashLen = (argv[3] !== undefined) ? parseInt(argv[3]) : 1; // 线长

    // 判断是否输入了虚线参数
    var isDashed = (argv[2] !== undefined && argv[3] !== undefined);

    // --- 如果输入了虚线参数，但其中一个为 0 或无效，则退出 ---
    if (isDashed) {
        if (isNaN(gapLen) || gapLen <= 0) {
            player.printError("无效参数：虚线空格长(参数2)必须大于 0！");
            return;
        }
        if (isNaN(dashLen) || dashLen <= 0) {
            player.printError("无效参数：虚线线长(参数3)必须大于 0！");
            return;
        }
    }

    var GAP_BLOCK_ID = "mishanguc:road_block"; // 虚线空缺处填充的方块

    // 方块配置映射表
    var blockConfig = {
        "wo": { out: "white_offset_out_ba", in: "white_offset_in_ba", def: "white_offset", useAxis: false },
        "yo": { out: "yellow_offset_out_ba", in: "yellow_offset_in_ba", def: "yellow_offset", useAxis: false },
        "w":  { out: "white_ba", in: "white_ba", def: "white", useAxis: true },
        "wt": { out: "white_ba_thick", in: "white_ba_thick", def: "white_thick", useAxis: true },
        "y":  { out: "yellow_ba", in: "yellow_ba", def: "yellow", useAxis: true },
        "yd": { out: "yellow_ba_double", in: "yellow_ba_double", def: "yellow_double", useAxis: true }
    };

    if (!type || !blockConfig[type]) {
        player.printError("请输入正确参数。仅支持：w, wt, wo, y, yd, yo");
        player.print("用法: /js <script> <类型> [空格长] [线长]");
        return;
    }

    // --- 启动主函数 ---
    var startPos = player.getBlockOn().toVector().toBlockPoint();
    if (isLineEndPoint(startPos)) {
        replaceFacingBlocks(startPos, 10000);
    } else {
        player.printError("这不是线的端点，请站在端点上运行。");
    }

    // --- 辅助函数定义 ---

    function getBaseName(pos) {
        var block = blocks.getBlock(pos);
        return block ? String(block).split("[")[0] : "minecraft:air";
    }

    function isLineEndPoint(pos) {
        var blockName = getBaseName(pos);
        if (blockName === "minecraft:air") return false;

        var directions = [
            BlockVector3.at(1,0,0), BlockVector3.at(-1,0,0), BlockVector3.at(0,0,1), BlockVector3.at(0,0,-1),
            BlockVector3.at(0,1,0), BlockVector3.at(0,-1,0), BlockVector3.at(1,1,0), BlockVector3.at(-1,1,0),
            BlockVector3.at(0,1,1), BlockVector3.at(0,1,-1), BlockVector3.at(1,-1,0), BlockVector3.at(-1,-1,0),
            BlockVector3.at(0,-1,1), BlockVector3.at(0,-1,-1)
        ];

        var connectedCount = 0;
        for (var i = 0; i < directions.length; i++) {
            if (getBaseName(pos.add(directions[i])) === blockName) connectedCount++;
        }
        return connectedCount <= 1;
    }

    function lineDirectionWithCorners(origin, distance) {
        var line_block_type = getBaseName(origin);
        var lines = [];
        var visited = {};

        var is_online = function (o, dir) {
            var pos = o.add(dir);
            if (visited[pos.toString()]) return false;
            return getBaseName(pos) === line_block_type;
        }

        var dir = BlockVector3.at(1, 0, 0);
        if (getBaseName(origin.subtract(dir)) === line_block_type) {
            dir = BlockVector3.at(-1, 0, 0);
        }

        var dx = dir.getX(), dz = dir.getZ();
        var up = BlockVector3.at(0, 1, 0), down = BlockVector3.at(0, -1, 0);

        for (var i = 0; i < distance; i++) {
            var facing = dx == -1 ? "north" : dx == 1 ? "south" : dz == 1 ? "west" : dz == -1 ? "east" : "";
            var left = BlockVector3.at(dz, 0, -dx), right = BlockVector3.at(-dz, 0, dx), straight = BlockVector3.at(dx, 0, dz);

            var leftConnected = is_online(origin, left) || is_online(origin, left.add(up)) || is_online(origin, left.add(down));
            var rightConnected = is_online(origin, right) || is_online(origin, right.add(up)) || is_online(origin, right.add(down));

            var cornerType = (leftConnected && !rightConnected) ? "inner" : (!leftConnected && rightConnected) ? "outer" : "";

            lines.push({ pos: origin, facing: facing, cornerType: cornerType });
            visited[origin.toString()] = true;

            var nextDir = null;
            var checks = [left.add(up), left, left.add(down), straight.add(up), straight, straight.add(down), right.add(up), right, right.add(down)];
            
            for (var j = 0; j < checks.length; j++) {
                if (is_online(origin, checks[j])) {
                    nextDir = checks[j];
                    break;
                }
            }

            if (!nextDir) break;
            dx = nextDir.getX(); dz = nextDir.getZ();
            origin = origin.add(nextDir);
        }
        return lines;
    }

    function replaceFacingBlocks(origin, distance) {
        var conf = blockConfig[type];
        var lines = lineDirectionWithCorners(origin, distance);
        var replacedCount = 0;

        var cycle = dashLen + gapLen;
        var cornerMap = {
            "north_outer": "north_east", "north_inner": "south_east",
            "east_outer":  "south_east", "east_inner":  "south_west",
            "south_outer": "south_west", "south_inner": "north_west",
            "west_outer":  "north_west", "west_inner":  "north_east"
        };

        for (var i = 0; i < lines.length; i++) {
            var info = lines[i];
            var newBlockStr = "";

            if (isDashed && (i % cycle >= dashLen)) {
                newBlockStr = GAP_BLOCK_ID;
            } else {
                if (info.cornerType === "") {
                    if (conf.useAxis) {
                        var axis = (info.facing === "north" || info.facing === "south") ? "x" : "z";
                        newBlockStr = "mishanguc:road_with_" + conf.def + "_line[axis=" + axis + "]";
                    } else {
                        newBlockStr = "mishanguc:road_with_" + conf.def + "_line[facing=" + info.facing + "]";
                    }
                } else {
                    var key = info.facing + "_" + info.cornerType;
                    var subType = info.cornerType === "outer" ? conf.out : conf.in;
                    var cornerFacing = cornerMap[key];
                    if (cornerFacing) {
                        newBlockStr = "mishanguc:road_with_" + subType + "_line[facing=" + cornerFacing + "]";
                    }
                }
            }

            if (newBlockStr) {
                var newBlock = context.getBlock(newBlockStr);
                if (newBlock) {
                    blocks.setBlock(info.pos, newBlock);
                    replacedCount++;
                }
            }
        }
        player.print("处理完成。当前配置：" + (isDashed ? "虚线模式("+dashLen+"-"+gapLen+")" : "实线模式") + "。已处理: " + replacedCount + " 个方块。");
    }

})(); 